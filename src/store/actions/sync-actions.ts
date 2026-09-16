import { expensesDB, incomesDB, budgetsDB, goalsDB, profileDB, obligationsDB } from '@/lib/db';
import { StoreSet, StoreGet, DatabaseStatus } from '../types';
import { Expense, Income, Budget, SavingsGoal, Obligation, UserProfile } from '@/types';

export const createSyncActions = (set: StoreSet, get: StoreGet) => ({
  checkDatabaseStatus: async (): Promise<DatabaseStatus> => {
    try {
      const response = await fetch('/api/sync?action=status');
      const data = await response.json();
      const status: DatabaseStatus = data.database || {
        connected: false,
        configured: false,
        type: 'mock',
        message: 'Modo local activo',
      };

      set((state) => ({
        sync: { ...state.sync, dbStatus: status },
      }));

      return status;
    } catch {
      const fallbackStatus: DatabaseStatus = {
        connected: false,
        configured: false,
        type: 'mock',
        message: 'No se pudo verificar el estado de la base de datos',
      };
      set((state) => ({
        sync: { ...state.sync, dbStatus: fallbackStatus },
      }));
      return fallbackStatus;
    }
  },

  syncToCloud: async () => {
    const { currentUserId, expenses, incomes, budgets, goals, profile, obligations } = get();

    if (!currentUserId) {
      return { success: false, error: 'Inicia sesión para sincronizar tus datos con la nube.' };
    }

    set((state) => ({
      sync: { ...state.sync, isSyncing: true, syncError: null },
    }));

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          expenses,
          incomes,
          budgets,
          goals,
          profile,
          obligations,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al sincronizar con la nube');
      }

      set((state) => ({
        sync: {
          ...state.sync,
          isSyncing: false,
          lastSyncTime: new Date().toISOString(),
          syncError: null,
          dbStatus: data.database || state.sync.dbStatus,
        },
      }));

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Error al sincronizar con la nube';
      set((state) => ({
        sync: { ...state.sync, syncError: errorMessage },
      }));
      return { success: false, error: errorMessage };
    } finally {
      set((state) => ({
        sync: { ...state.sync, isSyncing: false },
      }));
    }
  },

  syncFromCloud: async () => {
    const { currentUserId } = get();

    if (!currentUserId) {
      return { success: false, error: 'Inicia sesión para descargar tus datos desde la nube.' };
    }

    set((state) => ({
      sync: { ...state.sync, isSyncing: true, syncError: null },
    }));

    try {
      const response = await fetch(`/api/sync?userId=${currentUserId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener datos desde la nube');
      }

      const {
        expenses = [],
        incomes = [],
        budgets = [],
        goals = [],
        obligations = [],
        profile = null,
      } = data.data || {};

      // Clear local IndexedDB and save cloud data
      await Promise.all([
        expensesDB.clear(),
        incomesDB.clear(),
        budgetsDB.clear(),
        goalsDB.clear(),
        obligationsDB.clear(),
      ]);

      // Save expenses to IndexedDB
      for (const expense of expenses) {
        await expensesDB.add(expense);
      }

      // Save incomes to IndexedDB
      for (const income of incomes) {
        await incomesDB.add(income);
      }

      // Save budgets to IndexedDB
      for (const budget of budgets) {
        await budgetsDB.add(budget);
      }

      // Save goals to IndexedDB
      for (const goal of goals) {
        await goalsDB.add(goal);
      }

      // Save obligations to IndexedDB
      for (const obligation of obligations) {
        await obligationsDB.add(obligation);
      }

      // Update profile if exists
      if (profile) {
        await profileDB.set({ ...profile, id: 'profile' });
      }

      // Update state with cloud data
      set((state) => ({
        expenses,
        incomes,
        budgets,
        goals,
        obligations,
        profile: profile || state.profile,
        isOnboarded: profile?.onboardingCompleted ?? state.isOnboarded,
        sync: {
          ...state.sync,
          isSyncing: false,
          lastSyncTime: new Date().toISOString(),
          syncError: null,
          dbStatus: data.database || state.sync.dbStatus,
        },
      }));

      // Recalculate stats
      get().recalculateStats();

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Error al descargar datos desde la nube';
      set((state) => ({
        sync: { ...state.sync, syncError: errorMessage },
      }));
      return { success: false, error: errorMessage };
    } finally {
      set((state) => ({
        sync: { ...state.sync, isSyncing: false },
      }));
    }
  },

  restoreData: async (
    backupData: any,
    mode: 'replace' | 'merge' = 'replace'
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    if (!backupData || typeof backupData !== 'object') {
      return { success: false, message: 'Archivo de respaldo inválido o vacío' };
    }

    try {
      const newExpenses: Expense[] = Array.isArray(backupData.expenses) ? backupData.expenses : [];
      const newIncomes: Income[] = Array.isArray(backupData.incomes) ? backupData.incomes : [];
      const newBudgets: Budget[] = Array.isArray(backupData.budgets) ? backupData.budgets : [];
      const newGoals: SavingsGoal[] = Array.isArray(backupData.goals) ? backupData.goals : [];
      const newObligations: Obligation[] = Array.isArray(backupData.obligations)
        ? backupData.obligations
        : [];
      const newProfile: UserProfile | null = backupData.profile || null;

      if (mode === 'replace') {
        // Clear all current local IndexedDB stores
        await Promise.all([
          expensesDB.clear(),
          incomesDB.clear(),
          budgetsDB.clear(),
          goalsDB.clear(),
          obligationsDB.clear(),
          newProfile ? profileDB.clear() : Promise.resolve(),
        ]);

        for (const item of newExpenses) await expensesDB.add(item);
        for (const item of newIncomes) await incomesDB.add(item);
        for (const item of newBudgets) await budgetsDB.add(item);
        for (const item of newGoals) await goalsDB.add(item);
        for (const item of newObligations) await obligationsDB.add(item);
        if (newProfile) await profileDB.set({ ...newProfile, id: 'profile' });

        set((state) => ({
          expenses: newExpenses,
          incomes: newIncomes,
          budgets: newBudgets,
          goals: newGoals,
          obligations: newObligations,
          profile: newProfile || state.profile,
          isOnboarded: newProfile?.onboardingCompleted ?? true,
        }));
      } else {
        // Merge mode: add items that don't already exist
        const current = get();

        const existingExpenseIds = new Set(current.expenses.map((e) => e.id));
        const mergedExpenses = [...current.expenses];
        for (const item of newExpenses) {
          if (!existingExpenseIds.has(item.id)) {
            await expensesDB.add(item);
            mergedExpenses.push(item);
          }
        }

        const existingIncomeIds = new Set(current.incomes.map((i) => i.id));
        const mergedIncomes = [...current.incomes];
        for (const item of newIncomes) {
          if (!existingIncomeIds.has(item.id)) {
            await incomesDB.add(item);
            mergedIncomes.push(item);
          }
        }

        const existingBudgetCategories = new Set(current.budgets.map((b) => b.category));
        const mergedBudgets = [...current.budgets];
        for (const item of newBudgets) {
          if (!existingBudgetCategories.has(item.category)) {
            await budgetsDB.add(item);
            mergedBudgets.push(item);
          }
        }

        const existingGoalIds = new Set(current.goals.map((g) => g.id));
        const mergedGoals = [...current.goals];
        for (const item of newGoals) {
          if (!existingGoalIds.has(item.id)) {
            await goalsDB.add(item);
            mergedGoals.push(item);
          }
        }

        const existingObligationIds = new Set(current.obligations.map((o) => o.id));
        const mergedObligations = [...current.obligations];
        for (const item of newObligations) {
          if (!existingObligationIds.has(item.id)) {
            await obligationsDB.add(item);
            mergedObligations.push(item);
          }
        }

        if (newProfile && !current.profile) {
          await profileDB.set({ ...newProfile, id: 'profile' });
        }

        set({
          expenses: mergedExpenses,
          incomes: mergedIncomes,
          budgets: mergedBudgets,
          goals: mergedGoals,
          obligations: mergedObligations,
          profile: current.profile || newProfile,
          isOnboarded: true,
        });
      }

      // Recalculate monthly stats & financial health
      get().recalculateStats();

      // If logged in, trigger cloud sync in background
      if (get().currentUserId) {
        get().syncToCloud().catch(console.error);
      }

      return {
        success: true,
        message: `Restauración exitosa: ${newExpenses.length} gastos, ${newIncomes.length} ingresos, ${newBudgets.length} presupuestos y ${newGoals.length} metas procesados.`,
      };
    } catch (error: any) {
      console.error('Error al restaurar respaldo:', error);
      return {
        success: false,
        message: error.message || 'Error al procesar la copia de seguridad',
        error: error.message,
      };
    }
  },

  clearSyncError: () => {
    set((state) => ({
      sync: { ...state.sync, syncError: null },
    }));
  },
});
