import assert from 'assert';

/**
 * In-memory isolated financial engine replicating exact SaldoClaro store state & actions.
 * Operates purely in memory with zero cloud or local disk modifications.
 */
export function createIsolatedTestStore() {
  let expenses = [];
  let incomes = [];
  let obligations = [];
  let recurringObligations = [];
  let budgets = [];
  let goals = [];
  let periodStates = [];
  let periodRollovers = [];
  let profile = {
    currency: 'DOP',
    incomeFrequency: 'monthly',
    monthlyIncome: 60000,
    quincena1Day: 15,
    quincena2Day: 30,
  };
  let viewingPeriod = '2026-09';
  let activePayCycle = 'MONTHLY';
  let currentUserId = 'isolated_test_user';

  const closingLocks = new Set();
  const generationLocks = new Set();

  function generateId() {
    return 'iso_' + Math.random().toString(36).substring(2, 10);
  }

  function getPeriodState(period, cycle) {
    const id = `${period}_${cycle}`;
    return periodStates.find((ps) => ps.id === id);
  }

  function isPeriodClosed(period, cycle) {
    const monthlyState = getPeriodState(period, 'MONTHLY');
    if (monthlyState?.status === 'closed') return true;
    if (cycle && cycle !== 'MONTHLY') {
      const cycleState = getPeriodState(period, cycle);
      if (cycleState?.status === 'closed') return true;
    }
    return false;
  }

  function getObligationPaidAmount(obligationId) {
    return expenses
      .filter((e) => e.obligationId === obligationId && e.status !== 'reverted')
      .reduce((sum, e) => sum + e.amount, 0);
  }

  function getObligationRemainingAmount(obligation) {
    if (obligation.status === 'cancelled' || obligation.status === 'paid') return 0;
    if (obligation.isPaid && !obligation.status) return 0;
    const paid = getObligationPaidAmount(obligation.id);
    return Math.max(0, obligation.amount - paid);
  }

  function calculateObligationEffectiveStatus(obligation, todayStr = '2026-09-17') {
    if (obligation.status === 'cancelled') return 'cancelled';
    const paid = getObligationPaidAmount(obligation.id);
    const remaining = Math.max(0, obligation.amount - paid);
    if (remaining <= 0.001 || (obligation.isPaid && !obligation.status)) return 'paid';
    if (obligation.dueDate && obligation.dueDate < todayStr) return 'overdue';
    if (paid > 0) return 'partial';
    return 'pending';
  }

  function calculatePeriodSummary(period, cycle) {
    const existingState = getPeriodState(period, cycle);
    if (existingState?.status === 'closed' && existingState.frozenSummary) {
      return existingState.frozenSummary;
    }

    const q1Quota = 30000;
    const q2Quota = 30000;
    const monthQuota = 60000;

    const periodIncomes = incomes.filter((i) => i.date.startsWith(period));
    const cycleIncomes = periodIncomes.filter((i) => {
      if (cycle === 'MONTHLY') return true;
      return i.payCycle === cycle;
    });

    const salaryReceived = cycleIncomes
      .filter((i) => i.type === 'salary')
      .reduce((sum, i) => sum + i.amount, 0);
    const additionalReceived = cycleIncomes
      .filter((i) => i.type !== 'salary')
      .reduce((sum, i) => sum + i.amount, 0);
    const receivedIncome = salaryReceived + additionalReceived;

    let expectedSalary = cycle === 'Q1' ? q1Quota : cycle === 'Q2' ? q2Quota : monthQuota;
    const expectedIncome = expectedSalary + additionalReceived;
    const pendingIncome = Math.max(0, expectedSalary - salaryReceived);

    const cycleExpenses = expenses.filter((e) => {
      if (e.status === 'reverted') return false;
      const expPeriod = e.financialPeriod || e.date.slice(0, 7);
      if (expPeriod !== period) return false;
      if (cycle === 'MONTHLY') return true;
      return e.payCycle === cycle;
    });
    const totalExpenses = cycleExpenses.reduce((sum, e) => sum + e.amount, 0);

    const cycleObligations = obligations.filter((o) => {
      const obPeriod = o.period || (o.dueDate || '').slice(0, 7);
      if (obPeriod !== period) return false;
      if (cycle === 'MONTHLY') return true;
      return o.payCycle === cycle;
    });
    const pendingAmount = cycleObligations
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => {
        const paid = cycleExpenses.filter((e) => e.obligationId === o.id).reduce((s, e) => s + e.amount, 0);
        return sum + Math.max(0, o.amount - paid);
      }, 0);

    let initialBalance = 0;
    if (cycle === 'MONTHLY') {
      initialBalance = periodRollovers
        .filter((ro) => ro.destinationPeriod === period && ro.sourcePeriod !== period && ro.status === 'applied')
        .reduce((sum, ro) => sum + ro.amount, 0);
    } else if (cycle === 'Q1') {
      initialBalance = periodRollovers
        .filter(
          (ro) =>
            ro.destinationPeriod === period &&
            (ro.destinationCycle === 'Q1' || (ro.destinationCycle === 'MONTHLY' && ro.sourcePeriod !== period)) &&
            ro.status === 'applied'
        )
        .reduce((sum, ro) => sum + ro.amount, 0);
    } else {
      initialBalance = periodRollovers
        .filter((ro) => ro.destinationPeriod === period && ro.destinationCycle === 'Q2' && ro.status === 'applied')
        .reduce((sum, ro) => sum + ro.amount, 0);
    }

    const realFreeAvailable = receivedIncome + initialBalance - totalExpenses - pendingAmount;
    const projectedFreeAvailable = expectedIncome + initialBalance - totalExpenses - pendingAmount;

    let carryType = 'zero';
    if (realFreeAvailable > 0.009) carryType = 'surplus';
    else if (realFreeAvailable < -0.009) carryType = 'deficit';

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
      initialBalance,
      realFreeAvailable,
      projectedFreeAvailable,
      eligibleCarryAmount,
      carryType,
    };
  }

  async function addExpense(expenseData) {
    const period = expenseData.financialPeriod || expenseData.date.slice(0, 7);
    const cycle = expenseData.payCycle;
    if (isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden registrar gastos en un período cerrado (${period} ${cycle || ''}).`);
    }
    const exp = { ...expenseData, id: generateId(), status: 'active' };
    expenses.push(exp);
    return exp;
  }

  async function addIncome(incomeData) {
    const period = incomeData.date.slice(0, 7);
    const cycle = incomeData.payCycle;
    if (isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden registrar ingresos en un período cerrado (${period} ${cycle || ''}).`);
    }
    const inc = { ...incomeData, id: generateId() };
    incomes.push(inc);
    return inc;
  }

  async function addObligation(obData) {
    const period = obData.period || (obData.dueDate || '').slice(0, 7);
    const cycle = obData.payCycle;
    if (isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden registrar obligaciones en un período cerrado (${period} ${cycle || ''}).`);
    }
    const ob = { ...obData, id: generateId(), status: obData.status || 'pending' };
    obligations.push(ob);
    return ob;
  }

  async function addRecurringObligation(tplData) {
    const tpl = {
      ...tplData,
      id: generateId(),
      frequency: tplData.frequency || 'monthly',
      isActive: tplData.isActive !== undefined ? tplData.isActive : true,
    };
    recurringObligations.push(tpl);
    return tpl;
  }

  async function generatePeriodObligations(period) {
    const lockKey = `gen_${period}`;
    if (generationLocks.has(lockKey)) return { created: 0, skipped: 0, alreadyExisted: 0 };
    generationLocks.add(lockKey);

    try {
      let created = 0;
      let alreadyExisted = 0;
      let skipped = 0;

      for (const tpl of recurringObligations) {
        const idempotencyKey = `${currentUserId}_${tpl.id}_${period}`;
        const exists = obligations.some(
          (o) => o.idempotencyKey === idempotencyKey || (o.templateId === tpl.id && o.period === period)
        );
        if (exists) {
          alreadyExisted++;
          continue;
        }

        if (!tpl.isActive) {
          skipped++;
          continue;
        }

        const startPeriod = tpl.startDate.slice(0, 7);
        if (period < startPeriod) {
          skipped++;
          continue;
        }
        if (tpl.endDate && period > tpl.endDate.slice(0, 7)) {
          skipped++;
          continue;
        }

        if (isPeriodClosed(period, tpl.payCycle)) {
          skipped++;
          continue;
        }

        const [y, m] = period.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const safeDay = Math.min(Math.max(1, tpl.dayOfMonth), lastDay);
        const safeDueDate = `${period}-${String(safeDay).padStart(2, '0')}`;

        const newOb = {
          id: generateId(),
          name: tpl.name,
          amount: tpl.amount,
          category: tpl.category,
          payCycle: tpl.payCycle,
          dueDate: safeDueDate,
          isPaid: false,
          status: 'pending',
          period,
          templateId: tpl.id,
          idempotencyKey,
        };

        obligations.push(newOb);
        created++;
      }

      return { created, skipped, alreadyExisted };
    } finally {
      generationLocks.delete(lockKey);
    }
  }

  async function registerPayment(obligationId, amount, realDate, payCycle, financialPeriod) {
    const ob = obligations.find((o) => o.id === obligationId);
    if (!ob || ob.status === 'cancelled') return null;

    const period = financialPeriod || ob.period || realDate.slice(0, 7);
    if (isPeriodClosed(period, payCycle)) {
      throw new Error(`No se pueden realizar pagos en un período cerrado (${period} ${payCycle}).`);
    }

    const newExp = await addExpense({
      amount,
      category: ob.category,
      description: `Pago: ${ob.name}`,
      date: realDate,
      payCycle,
      financialPeriod: period,
      obligationId: ob.id,
    });

    const paid = getObligationPaidAmount(ob.id);
    const newStatus = paid >= ob.amount ? 'paid' : 'partial';
    ob.status = newStatus;
    ob.isPaid = newStatus === 'paid';

    return newExp;
  }

  async function revertPayment(expenseId) {
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return;

    const period = exp.financialPeriod || exp.date.slice(0, 7);
    const cycle = exp.payCycle;
    if (isPeriodClosed(period, cycle)) {
      throw new Error(`No se pueden revertir pagos en un período cerrado (${period} ${cycle || ''}).`);
    }

    if (exp.status === 'reverted') return;

    exp.status = 'reverted';
    if (exp.obligationId) {
      const ob = obligations.find((o) => o.id === exp.obligationId);
      if (ob) {
        const paid = getObligationPaidAmount(ob.id);
        const newStatus = paid >= ob.amount ? 'paid' : paid > 0 ? 'partial' : 'pending';
        ob.status = newStatus;
        ob.isPaid = newStatus === 'paid';
      }
    }
  }

  async function closePeriod({ period, cycle, carryAmount, goalAllocation, destinationPeriod, destinationCycle }) {
    const lockKey = `${period}_${cycle}`;
    if (closingLocks.has(lockKey)) {
      const existing = getPeriodState(period, cycle);
      if (existing) return existing;
    }
    closingLocks.add(lockKey);

    try {
      const summary = calculatePeriodSummary(period, cycle);
      const id = `${period}_${cycle}`;
      const now = new Date().toISOString();

      let destPeriod = destinationPeriod;
      let destCycle = destinationCycle;

      if (cycle === 'Q1') {
        destPeriod = period;
        destCycle = 'Q2';
      } else if (cycle === 'Q2') {
        destPeriod = undefined;
        destCycle = undefined;
      } else {
        destPeriod = destinationPeriod || '2026-10';
        destCycle = 'MONTHLY';
      }

      if (destPeriod && destCycle && isPeriodClosed(destPeriod, destCycle)) {
        throw new Error(`No se puede transferir saldo porque el período destino (${destPeriod} ${destCycle}) ya está cerrado.`);
      }

      const maxAllowed = summary.eligibleCarryAmount;
      let effectiveCarry = 0;
      if (summary.carryType === 'surplus') {
        const requested = typeof carryAmount === 'number' ? Math.max(0, carryAmount) : maxAllowed;
        effectiveCarry = Math.min(requested, maxAllowed);
      } else if (summary.carryType === 'deficit') {
        const requested = typeof carryAmount === 'number' ? Math.abs(carryAmount) : maxAllowed;
        effectiveCarry = -Math.min(requested, maxAllowed);
      }

      let goalAllocationData;
      if (goalAllocation && goalAllocation.amount > 0 && goalAllocation.goalId) {
        const targetGoal = goals.find((g) => g.id === goalAllocation.goalId);
        if (targetGoal) {
          const allocAmount = Math.min(goalAllocation.amount, Math.max(0, effectiveCarry));
          if (allocAmount > 0) {
            goalAllocationData = {
              goalId: targetGoal.id,
              goalName: targetGoal.name,
              amount: allocAmount,
            };
            targetGoal.currentAmount += allocAmount;
            effectiveCarry = Math.max(0, effectiveCarry - allocAmount);
          }
        }
      }

      const periodState = {
        id,
        userId: currentUserId,
        period,
        cycle,
        status: 'closed',
        closedAt: now,
        frozenSummary: { ...summary, closedAt: now },
      };

      periodStates = [...periodStates.filter((ps) => ps.id !== id), periodState];

      if (destPeriod && destCycle && (effectiveCarry !== 0 || goalAllocationData)) {
        const idempotencyKey = `${currentUserId}_${period}_${cycle}_${destPeriod}_${destCycle}`;
        const existingRollover = periodRollovers.find((ro) => ro.idempotencyKey === idempotencyKey);

        const rollover = {
          id: existingRollover?.id || generateId(),
          userId: currentUserId,
          sourcePeriod: period,
          sourceCycle: cycle,
          destinationPeriod: destPeriod,
          destinationCycle: destCycle,
          amount: effectiveCarry,
          type: effectiveCarry >= 0 ? 'surplus' : 'deficit',
          status: 'applied',
          idempotencyKey,
          goalAllocation: goalAllocationData,
        };

        periodRollovers = [...periodRollovers.filter((ro) => ro.id !== rollover.id), rollover];
      }

      return periodState;
    } finally {
      closingLocks.delete(lockKey);
    }
  }

  async function reopenPeriod({ period, cycle, reason }) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Debes proporcionar un motivo válido de al menos 5 caracteres para reabrir el período.');
    }

    const id = `${period}_${cycle}`;
    const now = new Date().toISOString();
    const updatedState = {
      id,
      userId: currentUserId,
      period,
      cycle,
      status: 'open',
      reopenedAt: now,
      reopenReason: reason.trim(),
      frozenSummary: undefined,
    };

    periodStates = [...periodStates.filter((ps) => ps.id !== id), updatedState];

    periodRollovers = periodRollovers.map((ro) => {
      if (ro.sourcePeriod === period && ro.sourceCycle === cycle) {
        return { ...ro, status: 'cancelled' };
      }
      return ro;
    });

    return updatedState;
  }

  return {
    state: {
      get expenses() { return expenses; },
      get incomes() { return incomes; },
      get obligations() { return obligations; },
      get recurringObligations() { return recurringObligations; },
      get budgets() { return budgets; },
      get goals() { return goals; },
      get periodStates() { return periodStates; },
      get periodRollovers() { return periodRollovers; },
      get profile() { return profile; },
    },
    setGoals: (g) => { goals = g; },
    getObligationPaidAmount,
    getObligationRemainingAmount,
    calculateObligationEffectiveStatus,
    calculatePeriodSummary,
    isPeriodClosed,
    addExpense,
    addIncome,
    addObligation,
    addRecurringObligation,
    generatePeriodObligations,
    registerPayment,
    revertPayment,
    closePeriod,
    reopenPeriod,
  };
}
