import {
  recurringObligationsDB,
  expensesDB,
  incomesDB,
  budgetsDB,
  goalsDB,
  profileDB,
  obligationsDB,
  periodStatesDB,
  periodRolloversDB,
  syncQueueDB,
  PendingChange,
} from '@/lib/db';
import { getAuthToken } from '@/lib/firebase';
import { generateId } from '@/lib/utils';
import { StoreSet, StoreGet, DatabaseStatus, SyncStatus } from '../types';
import { Expense, Income, Budget, SavingsGoal, Obligation, RecurringObligation, UserProfile, PeriodState, PeriodRollover } from '@/types';
import { reconcileRecordCollection, withRecordMetadata, getClientSource } from '@/lib/sync-conflict';

let debounceSyncTimer: ReturnType<typeof setTimeout> | null = null;

export const createSyncActions = (set: StoreSet, get: StoreGet) => ({
  setOnlineStatus: (isOnline: boolean) => {
    const currentSync = get().sync;
    if (isOnline === currentSync.isOnline) return;

    if (!isOnline) {
      set((state) => ({
        sync: {
          ...state.sync,
          isOnline: false,
          status: 'offline' as SyncStatus,
        },
      }));
    } else {
      set((state) => ({
        sync: {
          ...state.sync,
          isOnline: true,
          status: state.sync.pendingChangesCount > 0 ? 'saved_locally' : 'synced',
        },
      }));
      // Auto-retry sync when reconnecting
      if (get().currentUserId) {
        get().processPendingQueue().catch((err) => {
          console.warn('[Sync] Auto-retry after reconnect failed:', err);
        });
      }
    }
  },

  enqueuePendingChange: async (changeData: {
    entityType: PendingChange['entityType'];
    action: PendingChange['action'];
    entityId: string;
    payload?: any;
  }) => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const change: PendingChange = {
      id: generateId(),
      entityType: changeData.entityType,
      action: changeData.action,
      entityId: changeData.entityId,
      payload: changeData.payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    try {
      await syncQueueDB.add(change);
    } catch (err) {
      console.warn('[SyncQueue] Failed to record pending change to IndexedDB:', err);
    }

    // Refresh pending count
    let pendingCount = 1;
    try {
      const allPending = await syncQueueDB.getAll();
      pendingCount = allPending.length;
    } catch {
      pendingCount = (get().sync.pendingChangesCount || 0) + 1;
    }

    const newStatus: SyncStatus = !isOnline
      ? 'offline'
      : get().sync.isSyncing
      ? 'syncing'
      : 'saved_locally';

    set((state) => ({
      sync: {
        ...state.sync,
        isOnline,
        pendingChangesCount: pendingCount,
        status: newStatus,
      },
    }));

    // Schedule background sync if authenticated and online
    if (isOnline && get().currentUserId) {
      get().scheduleBackgroundSync();
    }
  },

  scheduleBackgroundSync: () => {
    if (debounceSyncTimer) {
      clearTimeout(debounceSyncTimer);
    }

    debounceSyncTimer = setTimeout(() => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isOnline && get().currentUserId) {
        get().processPendingQueue().catch((err) => {
          console.warn('[Sync] Background sync execution encountered:', err);
        });
      }
    }, 1500);
  },

  processPendingQueue: async () => {
    return get().syncToCloud();
  },

  checkDatabaseStatus: async (): Promise<DatabaseStatus> => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      const offlineStatus: DatabaseStatus = {
        connected: false,
        configured: false,
        type: 'mock',
        message: 'Sin conexión a internet (Modo local activo)',
      };
      set((state) => ({
        sync: { ...state.sync, isOnline: false, status: 'offline', dbStatus: offlineStatus },
      }));
      return offlineStatus;
    }

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
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const { currentUserId, expenses, incomes, budgets, goals, profile, obligations, recurringObligations, periodStates, periodRollovers } = get();

    if (!isOnline) {
      set((state) => ({
        sync: { ...state.sync, isOnline: false, status: 'offline', isSyncing: false },
      }));
      return { success: false, error: 'Sin conexión a internet. Los cambios están guardados localmente.' };
    }

    if (!currentUserId) {
      set((state) => ({
        sync: { ...state.sync, status: 'saved_locally', isSyncing: false },
      }));
      return { success: false, error: 'Inicia sesión para sincronizar tus datos con la nube.' };
    }

    set((state) => ({
      sync: { ...state.sync, isSyncing: true, status: 'syncing', syncError: null },
    }));

    try {
      // 1. Obtain verified Firebase ID token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Sesión no válida o expirada. Inicia sesión nuevamente.');
      }

      const clientSource = getClientSource();

      // Ensure every outgoing entity has valid metadata (userId, createdAt, updatedAt, deletedAt, source, sourceId)
      const payloadExpenses = expenses.map((e) => withRecordMetadata(e, { userId: currentUserId, source: clientSource }));
      const payloadIncomes = incomes.map((i) => withRecordMetadata(i, { userId: currentUserId, source: clientSource }));
      const payloadBudgets = budgets.map((b) => withRecordMetadata(b, { userId: currentUserId, source: clientSource }));
      const payloadGoals = goals.map((g) => withRecordMetadata(g, { userId: currentUserId, source: clientSource }));
      const payloadObligations = obligations.map((o) => withRecordMetadata(o, { userId: currentUserId, source: clientSource }));
      const payloadRecurring = (recurringObligations || []).map((r) => withRecordMetadata(r, { userId: currentUserId, source: clientSource }));
      const payloadPeriodStates = (periodStates || []).map((p) => withRecordMetadata(p, { userId: currentUserId, source: clientSource }));
      const payloadPeriodRollovers = (periodRollovers || []).map((r) => withRecordMetadata(r, { userId: currentUserId, source: clientSource }));
      const payloadProfile = profile ? withRecordMetadata(profile, { userId: currentUserId, source: clientSource }) : null;

      // 2. Transmit to server authenticated route with Authorization header
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expenses: payloadExpenses,
          incomes: payloadIncomes,
          budgets: payloadBudgets,
          goals: payloadGoals,
          obligations: payloadObligations,
          recurringObligations: payloadRecurring,
          periodStates: payloadPeriodStates,
          periodRollovers: payloadPeriodRollovers,
          profile: payloadProfile,
        }),
      });

      const data = await response.json();

      // Collect all successfully synced entity IDs
      const syncedIdSet = new Set<string>();
      if (data.syncedIds) {
        if (Array.isArray(data.syncedIds.expenses)) data.syncedIds.expenses.forEach((id: string) => syncedIdSet.add(id));
        if (Array.isArray(data.syncedIds.incomes)) data.syncedIds.incomes.forEach((id: string) => syncedIdSet.add(id));
        if (Array.isArray(data.syncedIds.budgets)) data.syncedIds.budgets.forEach((id: string) => syncedIdSet.add(id));
        if (Array.isArray(data.syncedIds.goals)) data.syncedIds.goals.forEach((id: string) => syncedIdSet.add(id));
        if (Array.isArray(data.syncedIds.obligations)) data.syncedIds.obligations.forEach((id: string) => syncedIdSet.add(id));
        if (Array.isArray(data.syncedIds.recurringObligations)) data.syncedIds.recurringObligations.forEach((id: string) => syncedIdSet.add(id));
        if (Array.isArray(data.syncedIds.periodStates)) data.syncedIds.periodStates.forEach((id: string) => syncedIdSet.add(id));
        if (Array.isArray(data.syncedIds.periodRollovers)) data.syncedIds.periodRollovers.forEach((id: string) => syncedIdSet.add(id));
        if (data.syncedIds.profile) syncedIdSet.add('profile');
      }

      // Selectively remove ONLY synced items from syncQueueDB, keeping failed/pending ones
      let remainingPendingCount = 0;
      try {
        const queuedItems = await syncQueueDB.getAll();
        for (const item of queuedItems) {
          if (syncedIdSet.has(item.entityId) || (item.entityType === 'profile' && syncedIdSet.has('profile'))) {
            await syncQueueDB.delete(item.id);
          }
        }
        const remainingQueue = await syncQueueDB.getAll();
        remainingPendingCount = remainingQueue.length;
      } catch (err) {
        console.warn('[SyncQueue] Error updating pending queue:', err);
      }

      const isCompleteSuccess = data.success === true && (!data.failed || data.failed.length === 0) && remainingPendingCount === 0;
      const isPartial = data.partial === true || (data.failed && data.failed.length > 0) || (remainingPendingCount > 0 && !isCompleteSuccess);

      const status: SyncStatus = isCompleteSuccess ? 'synced' : isPartial ? 'saved_locally' : 'error';
      const syncErrorMessage = data.errors && data.errors.length > 0 ? data.errors.join('; ') : data.error || null;

      set((state) => ({
        sync: {
          ...state.sync,
          isSyncing: false,
          isOnline: true,
          status,
          pendingChangesCount: remainingPendingCount,
          lastSyncTime: isCompleteSuccess || isPartial ? new Date().toISOString() : state.sync.lastSyncTime,
          syncError: syncErrorMessage,
          dbStatus: data.database || state.sync.dbStatus,
        },
      }));

      if (isCompleteSuccess) {
        return { success: true, syncedCount: expenses.length + incomes.length + obligations.length };
      } else {
        return {
          success: false,
          partial: isPartial,
          error: syncErrorMessage || 'Sincronización parcial: algunos elementos siguen pendientes',
          syncedCount: syncedIdSet.size,
          failedCount: data.failed?.length || remainingPendingCount,
        };
      }
    } catch (error: any) {
      const isNetworkError = !navigator.onLine || error.name === 'TypeError' || error.message?.includes('fetch');
      const errorMessage = error.message || 'Error al sincronizar con la nube';
      
      const nextStatus: SyncStatus = isNetworkError ? 'offline' : 'error';

      set((state) => ({
        sync: {
          ...state.sync,
          isSyncing: false,
          isOnline: !isNetworkError,
          status: nextStatus,
          syncError: errorMessage,
        },
      }));

      return { success: false, error: errorMessage };
    }
  },

  syncFromCloud: async () => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const { currentUserId } = get();

    if (!isOnline) {
      set((state) => ({
        sync: { ...state.sync, isOnline: false, status: 'offline', isSyncing: false },
      }));
      return { success: false, error: 'Sin conexión a internet para descargar datos.' };
    }

    if (!currentUserId) {
      return { success: false, error: 'Inicia sesión para descargar tus datos desde la nube.' };
    }

    set((state) => ({
      sync: { ...state.sync, isSyncing: true, status: 'syncing', syncError: null },
    }));

    try {
      // 1. Obtain verified Firebase ID token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Sesión no válida o expirada. Inicia sesión nuevamente.');
      }

      // 2. Fetch authenticated data from server using Bearer token
      const response = await fetch('/api/sync', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener datos desde la nube');
      }

      const {
        expenses: cloudExpenses = [],
        incomes: cloudIncomes = [],
        budgets: cloudBudgets = [],
        goals: cloudGoals = [],
        obligations: cloudObligations = [],
        recurringObligations: cloudRecurring = [],
        periodStates: cloudPeriodStates = [],
        periodRollovers: cloudPeriodRollovers = [],
        profile: cloudProfile = null,
      } = data.data || {};

      // 3. Perform granular per-record reconciliation for each collection (LWW)
      const localExpenses = await expensesDB.getAll();
      const expenseRecon = reconcileRecordCollection(localExpenses, cloudExpenses);
      for (const item of expenseRecon.toSaveLocally) await expensesDB.add(item);
      for (const id of expenseRecon.toDeleteLocally) await expensesDB.delete(id);

      const localIncomes = await incomesDB.getAll();
      const incomeRecon = reconcileRecordCollection(localIncomes, cloudIncomes);
      for (const item of incomeRecon.toSaveLocally) await incomesDB.add(item);
      for (const id of incomeRecon.toDeleteLocally) await incomesDB.delete(id);

      const localBudgets = await budgetsDB.getAll();
      const budgetRecon = reconcileRecordCollection(localBudgets, cloudBudgets);
      for (const item of budgetRecon.toSaveLocally) await budgetsDB.add(item);
      for (const id of budgetRecon.toDeleteLocally) await budgetsDB.delete(id);

      const localGoals = await goalsDB.getAll();
      const goalRecon = reconcileRecordCollection(localGoals, cloudGoals);
      for (const item of goalRecon.toSaveLocally) await goalsDB.add(item);
      for (const id of goalRecon.toDeleteLocally) await goalsDB.delete(id);

      const localObligations = await obligationsDB.getAll();
      const obligationRecon = reconcileRecordCollection(localObligations, cloudObligations);
      for (const item of obligationRecon.toSaveLocally) await obligationsDB.add(item);
      for (const id of obligationRecon.toDeleteLocally) await obligationsDB.delete(id);

      const localRecurring = await recurringObligationsDB.getAll();
      const recurringRecon = reconcileRecordCollection(localRecurring, cloudRecurring);
      for (const item of recurringRecon.toSaveLocally) await recurringObligationsDB.add(item);
      for (const id of recurringRecon.toDeleteLocally) await recurringObligationsDB.delete(id);

      const localPeriodStates = await periodStatesDB.getAll();
      const psRecon = reconcileRecordCollection(localPeriodStates, cloudPeriodStates);
      for (const item of psRecon.toSaveLocally) await periodStatesDB.update(item);
      for (const id of psRecon.toDeleteLocally) await periodStatesDB.delete(id);

      const localPeriodRollovers = await periodRolloversDB.getAll();
      const roRecon = reconcileRecordCollection(localPeriodRollovers, cloudPeriodRollovers);
      for (const item of roRecon.toSaveLocally) await periodRolloversDB.update(item);
      for (const id of roRecon.toDeleteLocally) await periodRolloversDB.delete(id);

      // 4. Update profile if cloud version is provided
      let finalProfile = get().profile;
      if (cloudProfile) {
        const mergedProfile = { ...(get().profile || {}), ...cloudProfile, id: 'profile' } as UserProfile;
        finalProfile = mergedProfile;
        await profileDB.set(mergedProfile);
      }

      // 5. Update Zustand store state with reconciled merged datasets
      set((state) => ({
        expenses: expenseRecon.merged,
        incomes: incomeRecon.merged,
        budgets: budgetRecon.merged,
        goals: goalRecon.merged,
        obligations: obligationRecon.merged,
        recurringObligations: recurringRecon.merged,
        periodStates: psRecon.merged,
        periodRollovers: roRecon.merged,
        profile: finalProfile || state.profile,
        isOnboarded: finalProfile?.onboardingCompleted ?? state.isOnboarded,
        sync: {
          ...state.sync,
          isSyncing: false,
          isOnline: true,
          status: 'synced',
          pendingChangesCount: 0,
          lastSyncTime: new Date().toISOString(),
          syncError: null,
          dbStatus: data.database || state.sync.dbStatus,
        },
      }));

      // Recalculate stats
      get().recalculateStats();

      // Check if local has newer records that need pushing back to cloud
      const hasLocalNewerChanges =
        expenseRecon.toPushToRemote.length > 0 ||
        incomeRecon.toPushToRemote.length > 0 ||
        budgetRecon.toPushToRemote.length > 0 ||
        goalRecon.toPushToRemote.length > 0 ||
        obligationRecon.toPushToRemote.length > 0 ||
        recurringRecon.toPushToRemote.length > 0 ||
        psRecon.toPushToRemote.length > 0 ||
        roRecon.toPushToRemote.length > 0;

      if (hasLocalNewerChanges) {
        get().syncToCloud().catch((err) => {
          console.warn('[Sync] Non-blocking push for merged local updates:', err);
        });
      }

      return { success: true };
    } catch (error: any) {
      const isNetworkError = !navigator.onLine || error.name === 'TypeError' || error.message?.includes('fetch');
      const errorMessage = error.message || 'Error al descargar datos desde la nube';
      const nextStatus: SyncStatus = isNetworkError ? 'offline' : 'error';

      set((state) => ({
        sync: {
          ...state.sync,
          isSyncing: false,
          isOnline: !isNetworkError,
          status: nextStatus,
          syncError: errorMessage,
        },
      }));
      return { success: false, error: errorMessage };
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
          recurringObligationsDB.clear(),
          syncQueueDB.clear(),
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

