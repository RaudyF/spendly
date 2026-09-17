import assert from 'assert';
import { createIsolatedTestStore } from './isolated-store-engine.mjs';

export async function runClosingRolloverTests() {
  const results = [];

  // 16. Cerrar, reabrir y volver a cerrar no duplica cierres ni arrastres
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 30000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 20000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });

    // 1st close
    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 10000 });
    assert.strictEqual(store.state.periodStates.length, 1);
    assert.strictEqual(store.state.periodRollovers.length, 1);
    assert.strictEqual(store.state.periodRollovers[0].status, 'applied');

    // Reopen
    await store.reopenPeriod({ period: '2026-09', cycle: 'Q1', reason: 'Reajuste de facturas' });
    assert.strictEqual(store.state.periodStates[0].status, 'open');
    assert.strictEqual(store.state.periodRollovers[0].status, 'cancelled');

    // 2nd close
    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 10000 });
    const appliedRollovers = store.state.periodRollovers.filter((ro) => ro.status === 'applied');
    const closedStates = store.state.periodStates.filter((ps) => ps.id === '2026-09_Q1');

    assert.strictEqual(closedStates.length, 1, 'Debe haber exactamente 1 registro de estado para el período');
    assert.strictEqual(appliedRollovers.length, 1, 'Debe haber exactamente 1 arrastre aplicado');

    results.push({
      testId: 16,
      suite: 'Closing/Rollover',
      name: 'Cerrar, reabrir y volver a cerrar no duplica cierres ni arrastres',
      passed: true,
      expected: '1 estado final closed, 1 arrastre applied',
      actual: `States=${closedStates.length}, AppliedRollovers=${appliedRollovers.length}`,
    });
  }

  // 17. pending_review no bloquea operaciones y closed sí las bloquea
  {
    const store = createIsolatedTestStore();
    // In unclosed past period (pending_review), expense should be allowed
    let allowedInPending = false;
    try {
      await store.addExpense({ amount: 1500, date: '2025-06-10', payCycle: 'Q1', financialPeriod: '2025-06' });
      allowedInPending = true;
    } catch (e) {
      allowedInPending = false;
    }

    // Now close 2025-06
    await store.closePeriod({ period: '2025-06', cycle: 'MONTHLY' });

    let blockedInClosed = false;
    try {
      await store.addExpense({ amount: 1500, date: '2025-06-12', payCycle: 'Q1', financialPeriod: '2025-06' });
    } catch (e) {
      blockedInClosed = true;
    }

    assert.strictEqual(allowedInPending, true, 'pending_review no debe bloquear');
    assert.strictEqual(blockedInClosed, true, 'closed debe bloquear operaciones');

    results.push({
      testId: 17,
      suite: 'Closing/Locking',
      name: 'pending_review no bloquea operaciones y closed sí las bloquea',
      passed: true,
      expected: 'pending_review allowed=true, closed blocked=true',
      actual: `PendingAllowed=${allowedInPending}, ClosedBlocked=${blockedInClosed}`,
    });
  }

  // 18. Q1 puede arrastrar a Q2 una sola vez
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 30000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 22000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });

    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 8000 });
    const q1Rollovers = store.state.periodRollovers.filter((ro) => ro.sourcePeriod === '2026-09' && ro.sourceCycle === 'Q1');
    const q2Summary = store.calculatePeriodSummary('2026-09', 'Q2');

    assert.strictEqual(q1Rollovers.length, 1, 'Q1 genera un solo arrastre');
    assert.strictEqual(q1Rollovers[0].destinationCycle, 'Q2', 'Destino es Q2');
    assert.strictEqual(q2Summary.initialBalance, 8000, 'Q2 recibe 8000');

    results.push({
      testId: 18,
      suite: 'Closing/Rollover',
      name: 'Q1 puede arrastrar a Q2 una sola vez',
      passed: true,
      expected: '1 arrastre hacia Q2 de RD$8,000',
      actual: `Count=${q1Rollovers.length}, Amount=${q1Rollovers[0].amount}, Dest=${q1Rollovers[0].destinationCycle}`,
    });
  }

  // 19. El cierre mensual no vuelve a contar el arrastre interno Q1 → Q2
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 30000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 25000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });
    // Q1 carry 5000 to Q2
    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 5000 });

    // Q2 movements: 30,000 salary, 20,000 expense
    await store.addIncome({ amount: 30000, date: '2026-09-20', payCycle: 'Q2', type: 'salary' });
    await store.addExpense({ amount: 20000, date: '2026-09-25', payCycle: 'Q2', financialPeriod: '2026-09' });

    // Close Monthly
    await store.closePeriod({ period: '2026-09', cycle: 'MONTHLY' });
    const octSummary = store.calculatePeriodSummary('2026-10', 'MONTHLY');

    // Total income = 60,000, Total expense = 45,000 -> Net surplus = 15,000
    // October initial balance must be 15,000 (NOT 15,000 + 5,000 = 20,000)
    assert.strictEqual(octSummary.initialBalance, 15000, 'Octubre no debe duplicar el arrastre interno Q1->Q2');

    results.push({
      testId: 19,
      suite: 'Closing/Rollover',
      name: 'El cierre mensual no vuelve a contar el arrastre interno Q1 → Q2',
      passed: true,
      expected: 'Octubre initialBalance = 15,000',
      actual: `Octubre initialBalance = ${octSummary.initialBalance}`,
    });
  }

  // 20. Aplicar la política final acordada para Q2 y el arrastre al mes siguiente
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 30000, date: '2026-09-20', payCycle: 'Q2', type: 'salary' });
    await store.addExpense({ amount: 18000, date: '2026-09-25', payCycle: 'Q2', financialPeriod: '2026-09' });

    await store.closePeriod({ period: '2026-09', cycle: 'Q2' });
    const q2State = store.state.periodStates.find((ps) => ps.id === '2026-09_Q2');
    const q2Rollovers = store.state.periodRollovers.filter((ro) => ro.sourcePeriod === '2026-09' && ro.sourceCycle === 'Q2');

    assert.strictEqual(q2State.status, 'closed', 'Q2 queda cerrado con resumen congelado');
    assert.strictEqual(q2Rollovers.length, 0, 'Q2 no emite arrastre intermensual independiente');

    results.push({
      testId: 20,
      suite: 'Closing/Policy',
      name: 'Aplicar la política final acordada para Q2 y el arrastre al mes siguiente',
      passed: true,
      expected: 'Q2 cerrado, 0 arrastres salientes intermensuales',
      actual: `Status=${q2State.status}, RolloversCount=${q2Rollovers.length}`,
    });
  }

  // 21. Solo Disponible Real puede arrastrarse, nunca Disponible Proyectado
  {
    const store = createIsolatedTestStore();
    // Expected salary: 30,000. Received: 22,000. Expenses: 14,000.
    // Real Available = 22,000 - 14,000 = 8,000. Projected = 30,000 - 14,000 = 16,000.
    await store.addIncome({ amount: 22000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 14000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });

    const summary = store.calculatePeriodSummary('2026-09', 'Q1');
    assert.strictEqual(summary.realFreeAvailable, 8000);
    assert.strictEqual(summary.projectedFreeAvailable, 16000);
    assert.strictEqual(summary.eligibleCarryAmount, 8000);

    // Try requesting 15,000 -> must cap at 8,000
    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 15000 });
    const ro = store.state.periodRollovers.find((r) => r.sourcePeriod === '2026-09' && r.sourceCycle === 'Q1');
    assert.strictEqual(ro.amount, 8000, 'Arrastre acotado a 8000');

    results.push({
      testId: 21,
      suite: 'Closing/Calculations',
      name: 'Solo Disponible Real puede arrastrarse, nunca Disponible Proyectado',
      passed: true,
      expected: 'Arrastre acotado a Disponible Real (8000 vs 16000)',
      actual: `CarryAmount=${ro.amount} (Real=${summary.realFreeAvailable}, Proj=${summary.projectedFreeAvailable})`,
    });
  }

  // 22. El arrastre no aparece como salario, ingreso adicional ni gasto
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 30000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 20000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });
    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 10000 });

    const q2Summary = store.calculatePeriodSummary('2026-09', 'Q2');
    assert.strictEqual(q2Summary.salaryReceived, 0, 'No cuenta como salario');
    assert.strictEqual(q2Summary.additionalReceived, 0, 'No cuenta como ingreso adicional');
    assert.strictEqual(q2Summary.totalExpenses, 0, 'No cuenta como gasto');
    assert.strictEqual(q2Summary.initialBalance, 10000, 'Aparece exclusivamente como initialBalance');

    results.push({
      testId: 22,
      suite: 'Closing/Isolation',
      name: 'El arrastre no aparece como salario, ingreso adicional ni gasto',
      passed: true,
      expected: 'Salary=0, Add=0, Exp=0, InitialBalance=10000',
      actual: `Salary=${q2Summary.salaryReceived}, Add=${q2Summary.additionalReceived}, Exp=${q2Summary.totalExpenses}, InitialBalance=${q2Summary.initialBalance}`,
    });
  }

  // 23. Un déficit llega como saldo inicial negativo
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 15000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 18000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });

    const summary = store.calculatePeriodSummary('2026-09', 'Q1');
    assert.strictEqual(summary.carryType, 'deficit');
    assert.strictEqual(summary.realFreeAvailable, -3000);

    await store.closePeriod({ period: '2026-09', cycle: 'Q1' });
    const q2Summary = store.calculatePeriodSummary('2026-09', 'Q2');
    assert.strictEqual(q2Summary.initialBalance, -3000, 'Saldo inicial en Q2 debe ser -3000');

    results.push({
      testId: 23,
      suite: 'Closing/Deficit',
      name: 'Un déficit llega como saldo inicial negativo',
      passed: true,
      expected: 'Q2 initialBalance = -3000',
      actual: `Q2 initialBalance = ${q2Summary.initialBalance}`,
    });
  }

  // 24. Enviar dinero a una meta reduce el saldo disponible para arrastrar
  {
    const store = createIsolatedTestStore();
    store.setGoals([{ id: 'g_vacaciones', name: 'Vacaciones', currentAmount: 5000, targetAmount: 30000 }]);
    await store.addIncome({ amount: 30000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 20000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });

    await store.closePeriod({
      period: '2026-09',
      cycle: 'Q1',
      carryAmount: 10000,
      goalAllocation: { goalId: 'g_vacaciones', amount: 4000 },
    });

    const goal = store.state.goals.find((g) => g.id === 'g_vacaciones');
    const ro = store.state.periodRollovers.find((r) => r.sourcePeriod === '2026-09' && r.sourceCycle === 'Q1');

    assert.strictEqual(goal.currentAmount, 9000, 'Meta aumentó en 4000');
    assert.strictEqual(ro.amount, 6000, 'Arrastre neto se redujo de 10000 a 6000');

    results.push({
      testId: 24,
      suite: 'Closing/GoalAllocation',
      name: 'Enviar dinero a una meta reduce el saldo disponible para arrastrar',
      passed: true,
      expected: 'Meta=9000 (+4000), Arrastre=6000 (10000 - 4000)',
      actual: `Goal=${goal.currentAmount}, Rollover=${ro.amount}`,
    });
  }

  // 25. Reabrir exige motivo y procesa controladamente el arrastre existente
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 30000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 20000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });
    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 10000 });

    let shortReasonRejected = false;
    try {
      await store.reopenPeriod({ period: '2026-09', cycle: 'Q1', reason: 'abc' });
    } catch (e) {
      shortReasonRejected = true;
    }
    assert.strictEqual(shortReasonRejected, true, 'Debe rechazar motivo corto');

    await store.reopenPeriod({ period: '2026-09', cycle: 'Q1', reason: 'Ajuste de recibo eléctrico' });
    const ro = store.state.periodRollovers.find((r) => r.sourcePeriod === '2026-09' && r.sourceCycle === 'Q1');
    const q2Summary = store.calculatePeriodSummary('2026-09', 'Q2');

    assert.strictEqual(ro.status, 'cancelled', 'Arrastre marcado como cancelled');
    assert.strictEqual(q2Summary.initialBalance, 0, 'Q2 ya no recibe saldo');

    results.push({
      testId: 25,
      suite: 'Closing/Reopen',
      name: 'Reabrir exige motivo y procesa controladamente el arrastre existente',
      passed: true,
      expected: 'Rechaza motivo <5 chars, cancela arrastre, restaura destino a 0',
      actual: `ShortRejected=${shortReasonRejected}, Status=${ro.status}, Q2InitialBalance=${q2Summary.initialBalance}`,
    });
  }

  // 26. Un destino cerrado rechaza modificaciones
  {
    const store = createIsolatedTestStore();
    // Close destination Q2 first
    await store.closePeriod({ period: '2026-09', cycle: 'Q2' });

    // Try closing Q1 transferring to closed Q2
    let destClosedRejected = false;
    try {
      await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 5000 });
    } catch (e) {
      destClosedRejected = true;
    }
    assert.strictEqual(destClosedRejected, true, 'Rechaza transferir saldo a un destino cerrado');

    results.push({
      testId: 26,
      suite: 'Closing/Immutability',
      name: 'Un destino cerrado rechaza modificaciones',
      passed: true,
      expected: 'Excepción lanzada impidiendo arrastrar a destino cerrado',
      actual: `Rejected=${destClosedRejected}`,
    });
  }

  // 27. frozenSummary no cambia por operaciones posteriores
  {
    const store = createIsolatedTestStore();
    await store.addIncome({ amount: 30000, date: '2026-09-05', payCycle: 'Q1', type: 'salary' });
    await store.addExpense({ amount: 15000, date: '2026-09-10', payCycle: 'Q1', financialPeriod: '2026-09' });
    await store.closePeriod({ period: '2026-09', cycle: 'Q1', carryAmount: 15000 });

    const ps = store.state.periodStates.find((s) => s.id === '2026-09_Q1');
    const frozenIncome = ps.frozenSummary.receivedIncome;
    const frozenExp = ps.frozenSummary.totalExpenses;

    // Simulate backend direct insertion attempt
    store.state.expenses.push({
      id: 'hacked_exp',
      amount: 99999,
      date: '2026-09-12',
      payCycle: 'Q1',
      financialPeriod: '2026-09',
      status: 'active',
    });

    const summaryAfter = store.calculatePeriodSummary('2026-09', 'Q1');
    assert.strictEqual(summaryAfter.receivedIncome, frozenIncome, 'Ingreso congelado inalterado');
    assert.strictEqual(summaryAfter.totalExpenses, frozenExp, 'Gastos congelados inalterados');

    results.push({
      testId: 27,
      suite: 'Closing/Immutability',
      name: 'frozenSummary no cambia por operaciones posteriores',
      passed: true,
      expected: 'Resumen congelado inmutable (Income=30k, Exp=15k)',
      actual: `Income=${summaryAfter.receivedIncome}, Exp=${summaryAfter.totalExpenses}`,
    });
  }

  return results;
}

if (process.argv[1].endsWith('closing-rollover.test.mjs')) {
  console.log('Running Closing & Rollover Tests...');
  runClosingRolloverTests().then((res) => {
    console.table(res);
    console.log(`Passed ${res.length} closing & rollover tests.`);
  });
}
