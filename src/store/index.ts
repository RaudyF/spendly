import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  db,
  expensesDB,
  incomesDB,
  budgetsDB,
  obligationsDB,
  recurringObligationsDB,
  periodStatesDB,
  periodRolloversDB,
  goalsDB,
  profileDB,
  insightsDB,
  syncQueueDB,
} from '@/lib/db';
import { getCurrentMonth, getPayCycleFromDate } from '@/lib/utils';
import { getFinancialMonth } from '@/lib/time';
import { Income, UserProfile } from '@/types';
import { AppState } from './types';
import {
  createExpenseActions,
  createIncomeActions,
  createBudgetActions,
  createObligationActions,
  createPeriodActions,
  createGoalActions,
  createProfileActions,
  createSyncActions,
  createStatsActions,
} from './actions';
import { isSalaryIncome, getSalaryQuotas } from './actions/stats-actions';

async function sanitizeSalaryIncomes(
  incomes: Income[],
  profile: UserProfile | null,
  currentMonth: string
): Promise<Income[]> {
  if (!profile || profile.incomeFrequency === 'variable' || !profile.monthlyIncome) {
    return incomes;
  }

  const { q1Quota, q2Quota } = getSalaryQuotas(profile);
  if (q1Quota <= 0) return incomes;

  const currentMonthIncomes = incomes.filter((i) => i.date.startsWith(currentMonth));
  const otherIncomes = incomes.filter((i) => !i.date.startsWith(currentMonth));

  // Solo filtramos y saneamos los ingresos identificados como salario del mes actual
  const salaryIncomes = currentMonthIncomes.filter(isSalaryIncome);
  const nonSalaryIncomes = currentMonthIncomes.filter((i) => !isSalaryIncome(i));

  const q1Salaries = salaryIncomes.filter(
    (i) => (i.payCycle || getPayCycleFromDate(i.date)) === 'Q1'
  );
  const q2Salaries = salaryIncomes.filter(
    (i) => (i.payCycle || getPayCycleFromDate(i.date)) === 'Q2'
  );

  const cleanQ1: Income[] = [];
  if (q1Salaries.length > 0) {
    const first = q1Salaries[0];
    // Si el registro de Q1 tiene un monto mayor a la cuota quincenal (ej. el error previo de 35,000)
    if (first.amount > q1Quota) {
      const updated: Income = {
        ...first,
        amount: q1Quota,
        payCycle: 'Q1',
        type: 'salary',
        status: 'received',
      };
      await incomesDB.update(updated);
      cleanQ1.push(updated);
    } else {
      cleanQ1.push(first);
    }

    // Si existen duplicados en Q1, eliminarlos para evitar duplicación
    for (let i = 1; i < q1Salaries.length; i++) {
      await incomesDB.delete(q1Salaries[i].id);
    }
  }

  const cleanQ2: Income[] = [];
  if (q2Salaries.length > 0) {
    const first = q2Salaries[0];
    if (first.amount > q2Quota) {
      const updated: Income = {
        ...first,
        amount: q2Quota,
        payCycle: 'Q2',
        type: 'salary',
        status: 'received',
      };
      await incomesDB.update(updated);
      cleanQ2.push(updated);
    } else {
      cleanQ2.push(first);
    }

    // Si existen duplicados en Q2, eliminarlos
    for (let i = 1; i < q2Salaries.length; i++) {
      await incomesDB.delete(q2Salaries[i].id);
    }
  }

  return [...otherIncomes, ...nonSalaryIncomes, ...cleanQ1, ...cleanQ2];
}

export type { AppState, SyncState } from './types';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      expenses: [],
      incomes: [],
      budgets: [],
      obligations: [],
      recurringObligations: [],
      periodStates: [],
      periodRollovers: [],
      goals: [],
      insights: [],
      profile: null,
      isLoading: true,
      isOnboarded: false,
      currentMonth: getCurrentMonth(),
      viewingPeriod: getFinancialMonth(),
      activePayCycle: 'MONTHLY',
      theme: 'dark',
      monthlyStats: null,
      financialHealth: null,
      currentUserId: null,
      sync: {
        status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'saved_locally',
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isSyncing: false,
        pendingChangesCount: 0,
        lastSyncTime: null,
        syncError: null,
      },

      // Initialize app with data from IndexedDB (user-specific)
      initialize: async (userId?: string) => {
        set({ isLoading: true });
        
        try {
          await db.init(userId);

          const [expenses, incomes, budgets, obligations, recurringObligations, periodStates, periodRollovers, goals, insights, profile, pendingChanges] =
            await Promise.all([
              expensesDB.getAll(),
              incomesDB.getAll(),
              budgetsDB.getAll(),
              obligationsDB.getAll(),
              recurringObligationsDB.getAll(),
              periodStatesDB.getAll(),
              periodRolloversDB.getAll(),
              goalsDB.getAll(),
              insightsDB.getAll(),
              profileDB.get(),
              syncQueueDB.getAll().catch(() => []),
            ]);

          const cleanIncomes = await sanitizeSalaryIncomes(
            incomes,
            profile || null,
            get().currentMonth || getCurrentMonth()
          );

          // Deduplicate budgets by (category, month)
          const seenBudgets = new Map<string, typeof budgets[0]>();
          const duplicateBudgetIds: string[] = [];
          for (const b of budgets) {
            const key = `${b.category}_${b.month}`;
            if (!seenBudgets.has(key)) {
              seenBudgets.set(key, b);
            } else {
              duplicateBudgetIds.push(b.id);
            }
          }
          const cleanBudgets = Array.from(seenBudgets.values());
          duplicateBudgetIds.forEach((id) => {
            budgetsDB.delete(id).catch((err) => console.error('Error deleting duplicate budget:', err));
          });

          const isOnboarded = profile?.onboardingCompleted || false;

          // Non-destructive migration for recurringObligations (ensure frequency & startDate defaults)
          const migratedRecurring = recurringObligations.map((r) => ({
            ...r,
            frequency: r.frequency || 'monthly',
            startDate: r.startDate || (r.createdAt ? r.createdAt.slice(0, 7) : '2026-01'),
            isActive: r.isActive !== undefined ? r.isActive : true,
          }));

          // Deduplicate recurring obligations by ID
          const seenRecurring = new Map<string, typeof migratedRecurring[0]>();
          for (const r of migratedRecurring) {
            if (!seenRecurring.has(r.id)) {
              seenRecurring.set(r.id, r);
            }
          }
          const cleanRecurring = Array.from(seenRecurring.values());

          // Deduplicate generated obligations by idempotencyKey or (templateId + period)
          const seenObligations = new Map<string, typeof obligations[0]>();
          const duplicateObligationIds: string[] = [];
          for (const o of obligations) {
            if (o.templateId && o.period) {
              const dedupKey = o.idempotencyKey || `${userId || 'local_user'}_${o.templateId}_${o.period}`;
              if (seenObligations.has(dedupKey)) {
                duplicateObligationIds.push(o.id);
              } else {
                seenObligations.set(dedupKey, o);
              }
            } else {
              seenObligations.set(o.id, o);
            }
          }
          const cleanObligations = Array.from(seenObligations.values());
          duplicateObligationIds.forEach((id) => {
            obligationsDB.delete(id).catch((err) => console.error('Error deleting duplicate obligation:', err));
          });

          const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
          const pendingCount = (pendingChanges && pendingChanges.length) || 0;

          set((state) => ({
            expenses,
            incomes: cleanIncomes,
            budgets: cleanBudgets,
            obligations: cleanObligations,
            recurringObligations: cleanRecurring,
            periodStates,
            periodRollovers,
            goals,
            insights,
            profile: profile || null,
            isOnboarded,
            currentUserId: userId || null,
            sync: {
              ...state.sync,
              isOnline,
              pendingChangesCount: pendingCount,
              status: !isOnline
                ? 'offline'
                : pendingCount > 0
                ? 'saved_locally'
                : state.sync.status,
            },
          }));

          get().recalculateStats();

          // If online and logged in, auto-trigger background sync
          if (isOnline && userId) {
            get().processPendingQueue().catch((err) => {
              console.warn('[Store] Initial auto-sync on load:', err);
            });
          }
        } catch (error) {
          console.error('Failed to initialize database:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      setTheme: (theme) => set({ theme }),

      // Spread in modular actions
      ...createExpenseActions(set, get),
      ...createIncomeActions(set, get),
      ...createBudgetActions(set, get),
      ...createObligationActions(set, get),
      ...createPeriodActions(set, get),
      ...createGoalActions(set, get),
      ...createProfileActions(set, get),
      ...createSyncActions(set, get),
      ...createStatsActions(set, get),

      // Reset store
      resetStore: async () => {
        try {
          await Promise.all([
            expensesDB.clear(),
            incomesDB.clear(),
            budgetsDB.clear(),
            obligationsDB.clear(),
            recurringObligationsDB.clear(),
            periodStatesDB.clear(),
            periodRolloversDB.clear(),
            goalsDB.clear(),
            insightsDB.clear(),
            profileDB.clear(),
            syncQueueDB.clear(),
          ]);
        } catch (error) {
          console.error('Failed to clear IndexedDB:', error);
        }

        set({
          expenses: [],
          incomes: [],
          budgets: [],
          obligations: [],
          recurringObligations: [],
          periodStates: [],
          periodRollovers: [],
          goals: [],
          insights: [],
          profile: null,
          isOnboarded: false,
          monthlyStats: null,
          financialHealth: null,
          sync: {
            status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'saved_locally',
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            isSyncing: false,
            pendingChangesCount: 0,
            lastSyncTime: null,
            syncError: null,
          },
        });
      },
    }),
    {
      name: 'saldoclaro-storage',
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} })),
      partialize: (state) => ({
        theme: state.theme,
        currentMonth: state.currentMonth,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('[Store] Hydrated from localStorage');
        }
      },
    }
  )
);
