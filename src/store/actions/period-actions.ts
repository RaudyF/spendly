import {
  PeriodCycle,
  PeriodStatus,
  PeriodState,
  PeriodRollover,
  PeriodFinancialSummary,
  ObligationBreakdownSummary,
} from '@/types';
import { periodStatesDB, periodRolloversDB, goalsDB } from '@/lib/db';
import { generateId, getPayCycleFromDate, getNextMonthPeriod } from '@/lib/utils';
import { getObligationPaidAmount, getObligationRemainingAmount } from '@/lib/obligations';
import { getSalaryQuotas, isSalaryIncome } from './stats-actions';
import { StoreSet, StoreGet } from '../types';

// In-flight concurrency lock to prevent duplicate simultaneous period closes
const closingLocks = new Set<string>();

export const createPeriodActions = (set: StoreSet, get: StoreGet) => ({
  getPeriodState: (period: string, cycle: PeriodCycle): PeriodState | undefined => {
    const id = `${period}_${cycle}`;
    return get().periodStates.find((ps) => ps.id === id);
  },

  getEffectivePeriodStatus: (period: string, cycle: PeriodCycle): PeriodStatus => {
    const explicitState = get().getPeriodState(period, cycle);
    if (explicitState) {
      return explicitState.status;
    }

    const currentMonth = get().currentMonth;
    const now = new Date();
    const currentDay = now.getDate();

    // Check if period is in the past
    if (period < currentMonth) {
      return 'pending_review';
    }

    // If current month, check cycle timeline
    if (period === currentMonth) {
      if (cycle === 'Q1' && currentDay > 15) {
        return 'pending_review';
      }
    }

    return 'open';
  },

  isPeriodClosed: (period: string, cycle?: PeriodCycle): boolean => {
    const monthlyState = get().getPeriodState(period, 'MONTHLY');
    if (monthlyState?.status === 'closed') {
      return true;
    }

    if (cycle && cycle !== 'MONTHLY') {
      const cycleState = get().getPeriodState(period, cycle);
      if (cycleState?.status === 'closed') {
        return true;
      }
    }

    return false;
  },

  calculatePeriodSummary: (period: string, cycle: PeriodCycle): PeriodFinancialSummary => {
    const { expenses, incomes, obligations, budgets, periodRollovers, profile } = get();

    // If period is closed and frozen summary exists, return it
    const existingState = get().getPeriodState(period, cycle);
    if (existingState?.status === 'closed' && existingState.frozenSummary) {
      return existingState.frozenSummary;
    }

    const { q1Quota, q2Quota, monthQuota, freq } = getSalaryQuotas(profile);

    // Filter incomes
    const periodIncomes = incomes.filter((i) => i.date.startsWith(period));
    const cycleIncomes = periodIncomes.filter((i) => {
      if (cycle === 'MONTHLY') return true;
      const incCycle = i.payCycle || getPayCycleFromDate(i.date);
      return incCycle === cycle;
    });

    const salaryReceived = cycleIncomes
      .filter(isSalaryIncome)
      .reduce((sum, i) => sum + i.amount, 0);

    const additionalReceived = cycleIncomes
      .filter((i) => !isSalaryIncome(i))
      .reduce((sum, i) => sum + i.amount, 0);

    const receivedIncome = salaryReceived + additionalReceived;

    let expectedSalary = 0;
    if (cycle === 'Q1') expectedSalary = q1Quota;
    else if (cycle === 'Q2') expectedSalary = q2Quota;
    else expectedSalary = monthQuota;

    const pendingIncome = freq === 'variable' ? 0 : Math.max(0, expectedSalary - salaryReceived);
    const expectedIncome = freq === 'variable' ? receivedIncome : expectedSalary + additionalReceived;

    // Filter expenses (non-reverted)
    const cycleExpenses = expenses.filter((e) => {
      if (e.status === 'reverted') return false;
      const expensePeriod = e.financialPeriod || e.date.slice(0, 7);
      if (expensePeriod !== period) return false;
      if (cycle === 'MONTHLY') return true;
      const expCycle = e.payCycle || getPayCycleFromDate(e.date);
      return expCycle === cycle;
    });

    const totalExpenses = cycleExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Filter obligations
    const cycleObligations = obligations.filter((o) => {
      const obligationPeriod = o.period || (o.dueDate || o.createdAt).slice(0, 7);
      if (obligationPeriod !== period) return false;
      if (cycle === 'MONTHLY') return true;
      return o.payCycle === cycle;
    });

    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let totalCommitted = 0;
    let paidAmount = 0;
    let pendingAmount = 0;

    cycleObligations.forEach((o) => {
      if (o.status === 'cancelled') {
        cancelledCount++;
        return;
      }

      const pAmount = getObligationPaidAmount(o.id, expenses);
      const rAmount = getObligationRemainingAmount(o, expenses);
      totalCommitted += o.amount;
      paidAmount += pAmount;
      pendingAmount += rAmount;

      if (rAmount === 0 || o.isPaid || o.status === 'paid') {
        paidCount++;
      } else if (pAmount > 0) {
        partialCount++;
      } else {
        pendingCount++;
      }
    });

    const obligationsSummary: ObligationBreakdownSummary = {
      totalCount: cycleObligations.length,
      paidCount,
      partialCount,
      pendingCount,
      cancelledCount,
      totalCommitted,
      paidAmount,
      pendingAmount,
    };

    // Budgets
    const periodBudgets = budgets.filter((b) => b.month === period);
    const budgetLimit = periodBudgets.reduce((sum, b) => sum + b.limit, 0);
    const budgetSpent = totalExpenses;

    // Initial Balance from applied rollovers
    let initialBalance = 0;
    if (cycle === 'MONTHLY') {
      // Anti-double-counting rule: Only transfers from previous months, NOT intra-month Q1->Q2
      initialBalance = periodRollovers
        .filter(
          (ro) =>
            ro.destinationPeriod === period &&
            ro.sourcePeriod !== period &&
            ro.status === 'applied'
        )
        .reduce((sum, ro) => sum + ro.amount, 0);
    } else if (cycle === 'Q1') {
      // Q1 initial balance comes from previous month's MONTHLY rollover (if any)
      initialBalance = periodRollovers
        .filter(
          (ro) =>
            ro.destinationPeriod === period &&
            (ro.destinationCycle === 'Q1' || (ro.destinationCycle === 'MONTHLY' && ro.sourcePeriod !== period)) &&
            ro.status === 'applied'
        )
        .reduce((sum, ro) => sum + ro.amount, 0);
    } else {
      // Q2 initial balance comes from Q1 of that same month
      initialBalance = periodRollovers
        .filter(
          (ro) =>
            ro.destinationPeriod === period &&
            ro.destinationCycle === 'Q2' &&
            ro.status === 'applied'
        )
        .reduce((sum, ro) => sum + ro.amount, 0);
    }

    // Real free available: Money received + initial balance - expenses - pending obligations
    const realFreeAvailable = receivedIncome + initialBalance - totalExpenses - pendingAmount;

    // Projected free available: Expected income + initial balance - expenses - pending obligations
    const projectedFreeAvailable = expectedIncome + initialBalance - totalExpenses - pendingAmount;

    let carryType: 'surplus' | 'deficit' | 'zero' = 'zero';
    if (realFreeAvailable > 0.009) {
      carryType = 'surplus';
    } else if (realFreeAvailable < -0.009) {
      carryType = 'deficit';
    }

    const eligibleCarryAmount = Math.abs(realFreeAvailable);

    return {
      period,
      cycle,
      expectedIncome,
      receivedIncome,
      pendingIncome,
      salaryReceived,
      additionalReceived,
      totalExpenses,
      obligations: obligationsSummary,
      budgetSpent,
      budgetLimit,
      initialBalance,
      realFreeAvailable,
      projectedFreeAvailable,
      eligibleCarryAmount,
      carryType,
      closedAt: new Date().toISOString(),
    };
  },

  getRolloversForPeriod: (period: string, cycle: PeriodCycle) => {
    const rollovers = get().periodRollovers;
    const received = rollovers.filter(
      (ro) =>
        ro.destinationPeriod === period &&
        ro.destinationCycle === cycle &&
        ro.status === 'applied'
    );
    const sent = rollovers.filter(
      (ro) =>
        ro.sourcePeriod === period &&
        ro.sourceCycle === cycle &&
        ro.status === 'applied'
    );
    return { received, sent };
  },

  closePeriod: async ({
    period,
    cycle,
    carryAmount,
    goalAllocation,
    destinationPeriod,
    destinationCycle,
  }: {
    period: string;
    cycle: PeriodCycle;
    carryAmount?: number;
    goalAllocation?: { goalId: string; amount: number };
    destinationPeriod?: string;
    destinationCycle?: PeriodCycle;
  }): Promise<PeriodState> => {
    const lockKey = `${period}_${cycle}`;
    if (closingLocks.has(lockKey)) {
      const existing = get().getPeriodState(period, cycle);
      if (existing) return existing;
    }
    closingLocks.add(lockKey);

    try {
      const summary = get().calculatePeriodSummary(period, cycle);
      const id = `${period}_${cycle}`;
      const now = new Date().toISOString();
      const currentUserId = get().currentUserId;
      const userId = currentUserId || 'local_user';

      // Validate destination and policy rules
      let destPeriod = destinationPeriod;
      let destCycle = destinationCycle;

      if (cycle === 'Q1') {
        destPeriod = period;
        destCycle = 'Q2';
      } else if (cycle === 'Q2') {
        // Q2 policy: Q2 closes and freezes summary, but does NOT create an independent inter-month rollover.
        destPeriod = undefined;
        destCycle = undefined;
      } else {
        // MONTHLY policy: MONTHLY is the single authorized closure to rollover to next month.
        destPeriod = destinationPeriod || getNextMonthPeriod(period);
        destCycle = 'MONTHLY';
      }

      // Check if destination period is already closed
      if (destPeriod && destCycle && get().isPeriodClosed(destPeriod, destCycle)) {
        throw new Error(`No se puede transferir saldo porque el período destino (${destPeriod} ${destCycle}) ya está cerrado.`);
      }

      // Cap carry amount strictly by eligible real free available (never projected)
      const maxAllowed = summary.eligibleCarryAmount;
      let effectiveCarry = 0;
      if (summary.carryType === 'surplus') {
        const requested = typeof carryAmount === 'number' ? Math.max(0, carryAmount) : maxAllowed;
        effectiveCarry = Math.min(requested, maxAllowed);
      } else if (summary.carryType === 'deficit') {
        const requested = typeof carryAmount === 'number' ? Math.abs(carryAmount) : maxAllowed;
        effectiveCarry = -Math.min(requested, maxAllowed);
      }

      // Goal allocation handling
      let goalAllocationData: { goalId: string; goalName: string; amount: number } | undefined = undefined;
      if (goalAllocation && goalAllocation.amount > 0 && goalAllocation.goalId) {
        const targetGoal = get().goals.find((g) => g.id === goalAllocation.goalId);
        if (targetGoal) {
          const allocAmount = Math.min(goalAllocation.amount, Math.max(0, effectiveCarry));
          if (allocAmount > 0) {
            goalAllocationData = {
              goalId: targetGoal.id,
              goalName: targetGoal.name,
              amount: allocAmount,
            };
            // Add to goal balance
            await get().addToGoal(targetGoal.id, allocAmount);
            effectiveCarry = Math.max(0, effectiveCarry - allocAmount);
          }
        }
      }

      const periodState: PeriodState = {
        id,
        userId: currentUserId || undefined,
        period,
        cycle,
        status: 'closed',
        closedAt: now,
        frozenSummary: {
          ...summary,
          closedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      // Update in-memory periodStates
      set((state) => ({
        periodStates: [
          ...state.periodStates.filter((ps) => ps.id !== id),
          periodState,
        ],
      }));

      // Save PeriodState to IndexedDB
      try {
        await periodStatesDB.update(periodState);
      } catch (err) {
        console.error('Failed to save period state to IndexedDB:', err);
      }

      // Background sync to Neon
      if (currentUserId && typeof window !== 'undefined') {
        import('@/lib/neon').then(({ savePeriodState }) => {
          savePeriodState({
            id: periodState.id,
            userId: currentUserId,
            period: periodState.period,
            cycle: periodState.cycle,
            status: periodState.status,
            closedAt: periodState.closedAt,
            frozenSummary: periodState.frozenSummary,
          }).catch((err) => console.warn('[PeriodState] Neon sync failed:', err));
        }).catch(() => {});
      }

      // Create / Update PeriodRollover if destination is authorized (Q1 -> Q2 or MONTHLY -> Next Month)
      if (destPeriod && destCycle && (effectiveCarry !== 0 || goalAllocationData)) {
        const idempotencyKey = `${userId}_${period}_${cycle}_${destPeriod}_${destCycle}`;
        const existingRollover = get().periodRollovers.find(
          (ro) => ro.idempotencyKey === idempotencyKey
        );

        const rollover: PeriodRollover = {
          id: existingRollover?.id || generateId(),
          userId: currentUserId || undefined,
          sourcePeriod: period,
          sourceCycle: cycle,
          destinationPeriod: destPeriod,
          destinationCycle: destCycle,
          amount: effectiveCarry,
          type: effectiveCarry >= 0 ? 'surplus' : 'deficit',
          status: 'applied',
          idempotencyKey,
          goalAllocation: goalAllocationData,
          createdAt: existingRollover?.createdAt || now,
          updatedAt: now,
        };

        set((state) => ({
          periodRollovers: [
            ...state.periodRollovers.filter((ro) => ro.id !== rollover.id),
            rollover,
          ],
        }));

        try {
          await periodRolloversDB.update(rollover);
        } catch (err) {
          console.error('Failed to save period rollover to IndexedDB:', err);
        }

        get().enqueuePendingChange({
          entityType: 'periodRollover',
          action: 'update',
          entityId: rollover.id,
          payload: rollover,
        }).catch(console.error);
      }

      get().enqueuePendingChange({
        entityType: 'periodState',
        action: 'update',
        entityId: periodState.id,
        payload: periodState,
      }).catch(console.error);

      // Recalculate stats
      get().recalculateStats();

      return periodState;
    } finally {
      closingLocks.delete(lockKey);
    }
  },

  reopenPeriod: async ({
    period,
    cycle,
    reason,
  }: {
    period: string;
    cycle: PeriodCycle;
    reason: string;
  }): Promise<PeriodState> => {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Debes proporcionar un motivo válido de al menos 5 caracteres para reabrir el período.');
    }

    const id = `${period}_${cycle}`;
    const existing = get().getPeriodState(period, cycle);
    const now = new Date().toISOString();
    const currentUserId = get().currentUserId;

    const updatedState: PeriodState = {
      id,
      userId: currentUserId || undefined,
      period,
      cycle,
      status: 'open',
      reopenedAt: now,
      reopenReason: reason.trim(),
      frozenSummary: undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    // Update in-memory periodStates
    set((state) => ({
      periodStates: [
        ...state.periodStates.filter((ps) => ps.id !== id),
        updatedState,
      ],
    }));

    // Cancel rollovers originating from this period and cycle
    const affectedRollovers = get().periodRollovers.filter(
      (ro) => ro.sourcePeriod === period && ro.sourceCycle === cycle && ro.status === 'applied'
    );

    if (affectedRollovers.length > 0) {
      const updatedRollovers = get().periodRollovers.map((ro) => {
        if (ro.sourcePeriod === period && ro.sourceCycle === cycle) {
          return { ...ro, status: 'cancelled' as const, updatedAt: now };
        }
        return ro;
      });

      set({ periodRollovers: updatedRollovers });

      for (const ro of affectedRollovers) {
        try {
          await periodRolloversDB.update({ ...ro, status: 'cancelled', updatedAt: now });
        } catch (err) {
          console.error('Failed to update cancelled rollover in IndexedDB:', err);
        }

        get().enqueuePendingChange({
          entityType: 'periodRollover',
          action: 'update',
          entityId: ro.id,
          payload: { ...ro, status: 'cancelled', updatedAt: now },
        }).catch(console.error);
      }
    }

    // Save updated PeriodState in IndexedDB
    try {
      await periodStatesDB.update(updatedState);
    } catch (err) {
      console.error('Failed to save reopened period state in IndexedDB:', err);
    }

    get().enqueuePendingChange({
      entityType: 'periodState',
      action: 'update',
      entityId: updatedState.id,
      payload: updatedState,
    }).catch(console.error);

    get().recalculateStats();

    return updatedState;
  },
});
