import {
  expensesDB,
  budgetsDB,
  goalsDB,
  incomesDB,
  profileDB,
  obligationsDB,
  recurringObligationsDB,
  periodStatesDB,
  periodRolloversDB,
} from './db';
import type {
  Expense,
  Budget,
  SavingsGoal,
  Income,
  UserProfile,
  Obligation,
  RecurringObligation,
  PeriodState,
  PeriodRollover,
} from '@/types';
import { reconcileRecordCollection, withRecordMetadata, getClientSource } from './sync-conflict';

export interface SyncResult {
  success: boolean;
  error?: string;
  synced: {
    expenses: number;
    budgets: number;
    goals: number;
    incomes: number;
    obligations?: number;
    recurringObligations?: number;
    periodStates?: number;
    periodRollovers?: number;
  };
}

/**
 * Check if we're running on the server side where database is available
 */
function isServerSide(): boolean {
  return typeof window === 'undefined';
}

/**
 * Push local data to cloud database
 */
export async function pushToCloud(userId: string): Promise<SyncResult> {
  if (!isServerSide()) {
    return {
      success: false,
      error: 'Cloud sync is only available through API routes.',
      synced: { expenses: 0, budgets: 0, goals: 0, incomes: 0 },
    };
  }

  const result: SyncResult = {
    success: true,
    synced: { expenses: 0, budgets: 0, goals: 0, incomes: 0 },
  };

  try {
    const neon = await import('./neon');
    const source = getClientSource();
    
    // Sync expenses
    const expenses = await expensesDB.getAll();
    for (const expense of expenses) {
      await neon.createExpense({
        ...withRecordMetadata(expense, { userId, source }),
        userId,
      });
      result.synced.expenses++;
    }

    // Sync budgets
    const budgets = await budgetsDB.getAll();
    for (const budget of budgets) {
      await neon.createBudget({
        ...withRecordMetadata(budget, { userId, source }),
        userId,
        amount: budget.limit,
        period: budget.month,
      });
      result.synced.budgets++;
    }

    // Sync goals
    const goals = await goalsDB.getAll();
    for (const goal of goals) {
      await neon.createGoal({
        ...withRecordMetadata(goal, { userId, source }),
        userId,
        deadline: goal.deadline || null,
      });
      result.synced.goals++;
    }

    // Sync recurring obligation templates
    const recurringList = await recurringObligationsDB.getAll();
    for (const tpl of recurringList) {
      await neon.createRecurringObligation({
        ...withRecordMetadata(tpl, { userId, source }),
        userId,
      });
    }
    result.synced.recurringObligations = recurringList.length;

    // Sync obligation instances
    const obligations = await obligationsDB.getAll();
    for (const obs of obligations) {
      await neon.createObligation({
        ...withRecordMetadata(obs, { userId, source }),
        userId,
      });
    }
    result.synced.obligations = obligations.length;

    // Sync period states
    const periodStates = await periodStatesDB.getAll();
    for (const ps of periodStates) {
      await neon.savePeriodState({
        ...withRecordMetadata(ps, { userId, source }),
        userId,
      });
    }
    result.synced.periodStates = periodStates.length;

    // Sync period rollovers
    const rollovers = await periodRolloversDB.getAll();
    for (const ro of rollovers) {
      await neon.savePeriodRollover({
        ...withRecordMetadata(ro, { userId, source }),
        userId,
      });
    }
    result.synced.periodRollovers = rollovers.length;

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to sync to cloud',
      synced: result.synced,
    };
  }
}

/**
 * Pull data from cloud database to local storage using per-record reconciliation
 * Preserves local unsynced edits and pulls newer remote changes without wiping data.
 */
export async function pullFromCloud(userId: string): Promise<SyncResult> {
  if (!isServerSide()) {
    return {
      success: false,
      error: 'Cloud sync is only available through API routes.',
      synced: { expenses: 0, budgets: 0, goals: 0, incomes: 0 },
    };
  }

  const result: SyncResult = {
    success: true,
    synced: { expenses: 0, budgets: 0, goals: 0, incomes: 0 },
  };

  try {
    const neon = await import('./neon');
    
    // 1. Reconcile expenses
    const localExpenses = await expensesDB.getAll();
    const cloudExpenses = (await neon.getExpenses(userId)).map((e: any) => ({
      id: e.id,
      userId,
      amount: parseFloat(e.amount),
      category: e.category,
      description: e.description || '',
      date: e.date,
      payCycle: e.pay_cycle || undefined,
      createdAt: e.created_at || new Date().toISOString(),
      updatedAt: e.updated_at || e.created_at || new Date().toISOString(),
      deletedAt: e.deleted_at || null,
      source: e.source || 'cloud',
      sourceId: e.source_id,
    }));
    const expenseRecon = reconcileRecordCollection(localExpenses, cloudExpenses);
    for (const item of expenseRecon.toSaveLocally) {
      await expensesDB.add(item);
    }
    for (const id of expenseRecon.toDeleteLocally) {
      await expensesDB.delete(id);
    }
    result.synced.expenses = expenseRecon.merged.length;

    // 2. Reconcile budgets
    const localBudgets = await budgetsDB.getAll();
    const cloudBudgets = (await neon.getBudgets(userId)).map((b: any) => ({
      id: b.id,
      userId,
      category: b.category,
      limit: parseFloat(b.amount),
      spent: 0,
      month: b.period,
      periodType: b.period_type || 'MONTHLY',
      createdAt: b.created_at || new Date().toISOString(),
      updatedAt: b.updated_at || new Date().toISOString(),
      deletedAt: b.deleted_at || null,
      source: b.source || 'cloud',
      sourceId: b.source_id,
    }));
    const budgetRecon = reconcileRecordCollection(localBudgets, cloudBudgets);
    for (const item of budgetRecon.toSaveLocally) {
      await budgetsDB.add(item);
    }
    for (const id of budgetRecon.toDeleteLocally) {
      await budgetsDB.delete(id);
    }
    result.synced.budgets = budgetRecon.merged.length;

    // 3. Reconcile goals
    const localGoals = await goalsDB.getAll();
    const cloudGoals = (await neon.getGoals(userId)).map((g: any) => ({
      id: g.id,
      userId,
      name: g.name,
      targetAmount: parseFloat(g.target_amount),
      currentAmount: parseFloat(g.current_amount),
      deadline: g.deadline || undefined,
      color: g.color || '#3B82F6',
      icon: g.icon || 'piggy-bank',
      createdAt: g.created_at || new Date().toISOString(),
      updatedAt: g.updated_at || new Date().toISOString(),
      deletedAt: g.deleted_at || null,
      source: g.source || 'cloud',
      sourceId: g.source_id,
    }));
    const goalRecon = reconcileRecordCollection(localGoals, cloudGoals);
    for (const item of goalRecon.toSaveLocally) {
      await goalsDB.add(item);
    }
    for (const id of goalRecon.toDeleteLocally) {
      await goalsDB.delete(id);
    }
    result.synced.goals = goalRecon.merged.length;

    // 4. Reconcile recurring templates
    const localRecurring = await recurringObligationsDB.getAll();
    const cloudRecurring = (await neon.getRecurringObligations(userId)).map((r: any) => ({
      id: r.id,
      userId,
      name: r.name,
      amount: parseFloat(r.amount),
      category: r.category,
      frequency: r.frequency || 'monthly',
      dayOfMonth: r.day_of_month || 1,
      payCycle: r.pay_cycle || 'MONTHLY',
      startDate: r.start_date,
      endDate: r.end_date || undefined,
      isActive: Boolean(r.is_active ?? true),
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || new Date().toISOString(),
      deletedAt: r.deleted_at || null,
      source: r.source || 'cloud',
      sourceId: r.source_id,
    }));
    const recRecon = reconcileRecordCollection(localRecurring, cloudRecurring);
    for (const item of recRecon.toSaveLocally) {
      await recurringObligationsDB.add(item);
    }
    for (const id of recRecon.toDeleteLocally) {
      await recurringObligationsDB.delete(id);
    }
    result.synced.recurringObligations = recRecon.merged.length;

    // 5. Reconcile obligations
    const localObligations = await obligationsDB.getAll();
    const cloudObligations = (await neon.getObligations(userId)).map((o: any) => ({
      id: o.id,
      userId,
      name: o.name,
      amount: parseFloat(o.amount),
      category: o.category,
      payCycle: o.pay_cycle,
      dueDate: o.due_date || undefined,
      isPaid: Boolean(o.is_paid),
      status: o.status || 'pending',
      period: o.period || undefined,
      templateId: o.template_id || undefined,
      idempotencyKey: o.idempotency_key || undefined,
      createdAt: o.created_at || new Date().toISOString(),
      updatedAt: o.updated_at || new Date().toISOString(),
      deletedAt: o.deleted_at || null,
      source: o.source || 'cloud',
      sourceId: o.source_id,
    }));
    const obsRecon = reconcileRecordCollection(localObligations, cloudObligations);
    for (const item of obsRecon.toSaveLocally) {
      await obligationsDB.add(item);
    }
    for (const id of obsRecon.toDeleteLocally) {
      await obligationsDB.delete(id);
    }
    result.synced.obligations = obsRecon.merged.length;

    // 6. Reconcile period states
    const localPeriodStates = await periodStatesDB.getAll();
    const cloudPeriodStates = (await neon.getPeriodStates(userId)).map((ps: any) => ({
      id: ps.id,
      userId,
      period: ps.period,
      cycle: ps.cycle,
      status: ps.status,
      closedAt: ps.closed_at ? new Date(ps.closed_at).toISOString() : undefined,
      reopenedAt: ps.reopened_at ? new Date(ps.reopened_at).toISOString() : undefined,
      reopenReason: ps.reopen_reason || undefined,
      frozenSummary: ps.frozen_summary || undefined,
      createdAt: ps.created_at || new Date().toISOString(),
      updatedAt: ps.updated_at || new Date().toISOString(),
      deletedAt: ps.deleted_at || null,
      source: ps.source || 'cloud',
      sourceId: ps.source_id,
    }));
    const psRecon = reconcileRecordCollection(localPeriodStates, cloudPeriodStates);
    for (const item of psRecon.toSaveLocally) {
      await periodStatesDB.update(item);
    }
    for (const id of psRecon.toDeleteLocally) {
      await periodStatesDB.delete(id);
    }
    result.synced.periodStates = psRecon.merged.length;

    // 7. Reconcile period rollovers
    const localRollovers = await periodRolloversDB.getAll();
    const cloudRollovers = (await neon.getPeriodRollovers(userId)).map((ro: any) => ({
      id: ro.id,
      userId,
      sourcePeriod: ro.source_period,
      sourceCycle: ro.source_cycle,
      destinationPeriod: ro.destination_period,
      destinationCycle: ro.destination_cycle,
      amount: parseFloat(ro.amount),
      type: ro.type,
      status: ro.status,
      idempotencyKey: ro.idempotency_key || undefined,
      goalAllocation: ro.goal_allocation || undefined,
      createdAt: ro.created_at || new Date().toISOString(),
      updatedAt: ro.updated_at || new Date().toISOString(),
      deletedAt: ro.deleted_at || null,
      source: ro.source || 'cloud',
      sourceId: ro.source_id,
    }));
    const roRecon = reconcileRecordCollection(localRollovers, cloudRollovers);
    for (const item of roRecon.toSaveLocally) {
      await periodRolloversDB.update(item);
    }
    for (const id of roRecon.toDeleteLocally) {
      await periodRolloversDB.delete(id);
    }
    result.synced.periodRollovers = roRecon.merged.length;

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to sync from cloud',
      synced: result.synced,
    };
  }
}

/**
 * Full two-way sync - merges local and cloud data non-destructively
 */
export async function syncData(userId: string): Promise<SyncResult> {
  if (!isServerSide()) {
    return {
      success: false,
      error: 'Cloud sync is only available through API routes.',
      synced: { expenses: 0, budgets: 0, goals: 0, incomes: 0 },
    };
  }

  try {
    const pushResult = await pushToCloud(userId);
    if (!pushResult.success) {
      return pushResult;
    }

    const pullResult = await pullFromCloud(userId);
    
    return {
      success: pullResult.success,
      error: pullResult.error,
      synced: {
        expenses: pushResult.synced.expenses + pullResult.synced.expenses,
        budgets: pushResult.synced.budgets + pullResult.synced.budgets,
        goals: pushResult.synced.goals + pullResult.synced.goals,
        incomes: pushResult.synced.incomes + pullResult.synced.incomes,
        obligations: (pushResult.synced.obligations || 0) + (pullResult.synced.obligations || 0),
        recurringObligations: (pushResult.synced.recurringObligations || 0) + (pullResult.synced.recurringObligations || 0),
        periodStates: (pushResult.synced.periodStates || 0) + (pullResult.synced.periodStates || 0),
        periodRollovers: (pushResult.synced.periodRollovers || 0) + (pullResult.synced.periodRollovers || 0),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Sync failed',
      synced: { expenses: 0, budgets: 0, goals: 0, incomes: 0 },
    };
  }
}

/**
 * Check if cloud sync is enabled for user
 */
export function isSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('saldoclaro-cloud-sync') === 'true';
}

/**
 * Enable/disable cloud sync
 */
export function setSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('saldoclaro-cloud-sync', enabled ? 'true' : 'false');
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): Date | null {
  if (typeof window === 'undefined') return null;
  const timestamp = localStorage.getItem('saldoclaro-last-sync');
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Set last sync timestamp
 */
export function setLastSyncTime(date: Date = new Date()): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('saldoclaro-last-sync', date.toISOString());
}
