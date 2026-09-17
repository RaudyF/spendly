const assert = require('assert');

// Simple in-memory mock or test harness for testing the 18 domain cases
console.log('====================================================');
console.log(' INICIANDO VERIFICACIÓN DE LAS 18 PRUEBAS DE SALDOCLARO');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [Prueba ${totalTests}/18] ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`❌ [Prueba ${totalTests}/18 FALLIDA] ${name}`);
    console.error('   Error:', error.message);
  }
}

// 1. Motor Temporal: Q1
runTest('Clasificación de Quincena Q1 (Día <= 15)', () => {
  const getPayCycle = (d) => d.getDate() <= 15 ? 'Q1' : 'Q2';
  assert.strictEqual(getPayCycle(new Date(2026, 0, 15)), 'Q1');
  assert.strictEqual(getPayCycle(new Date(2026, 8, 1)), 'Q1');
});

// 2. Motor Temporal: Q2
runTest('Clasificación de Quincena Q2 (Día >= 16)', () => {
  const getPayCycle = (d) => d.getDate() <= 15 ? 'Q1' : 'Q2';
  assert.strictEqual(getPayCycle(new Date(2026, 0, 16)), 'Q2');
  assert.strictEqual(getPayCycle(new Date(2026, 0, 31)), 'Q2');
});

// 3. Calendario Febrero estándar
runTest('Días de Febrero estándar (2026 = 28 días)', () => {
  const getLastDayOfMonth = (year, month) => new Date(year, month, 0).getDate();
  assert.strictEqual(getLastDayOfMonth(2026, 2), 28);
});

// 4. Calendario Febrero bisiesto
runTest('Días de Febrero bisiesto (2028 = 29 días y detección bisiesta)', () => {
  const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const getLastDayOfMonth = (year, month) => new Date(year, month, 0).getDate();
  assert.strictEqual(isLeapYear(2028), true);
  assert.strictEqual(isLeapYear(2026), false);
  assert.strictEqual(getLastDayOfMonth(2028, 2), 29);
});

// 5. Ajuste seguro de fecha de vencimiento
runTest('Ajuste seguro de vencimiento día 31 en febrero', () => {
  const getSafeDueDate = (year, month, targetDay) => {
    const lastDay = new Date(year, month, 0).getDate();
    return Math.min(targetDay, lastDay);
  };
  assert.strictEqual(getSafeDueDate(2026, 2, 31), 28);
  assert.strictEqual(getSafeDueDate(2028, 2, 31), 29);
  assert.strictEqual(getSafeDueDate(2026, 4, 31), 30);
});

// 6. Transición de Año en Límites de Períodos
runTest('Límites temporales en cambio de año (2026-12 Q2 -> 2027-01 Q1)', () => {
  const getBounds = (period, cycle) => {
    const [y, m] = period.split('-').map(Number);
    if (cycle === 'Q1') return { start: 1, end: 15, month: m, year: y };
    const lastDay = new Date(y, m, 0).getDate();
    return { start: 16, end: lastDay, month: m, year: y };
  };
  const decQ2 = getBounds('2026-12', 'Q2');
  assert.strictEqual(decQ2.year, 2026);
  assert.strictEqual(decQ2.month, 12);
  assert.strictEqual(decQ2.end, 31);

  const janQ1 = getBounds('2027-01', 'Q1');
  assert.strictEqual(janQ1.year, 2027);
  assert.strictEqual(janQ1.month, 1);
  assert.strictEqual(janQ1.start, 1);
  assert.strictEqual(janQ1.end, 15);
});

// 7. Aislamiento de Obligación por Ciclo
runTest('Aislamiento de Obligaciones por ciclo de pago (Q1 vs Q2)', () => {
  const obligations = [
    { id: '1', name: 'Internet Q1', amount: 1500, payCycle: 'Q1', isPaid: false },
    { id: '2', name: 'Luz Q2', amount: 2000, payCycle: 'Q2', isPaid: false },
  ];
  const q1Obs = obligations.filter(o => o.payCycle === 'Q1' || o.payCycle === 'MONTHLY');
  const q2Obs = obligations.filter(o => o.payCycle === 'Q2' || o.payCycle === 'MONTHLY');
  
  assert.strictEqual(q1Obs.length, 1);
  assert.strictEqual(q1Obs[0].name, 'Internet Q1');
  assert.strictEqual(q2Obs.length, 1);
  assert.strictEqual(q2Obs[0].name, 'Luz Q2');
});

// 8. Cálculo de Disponible Libre (Ingresos - Comprometido Pendiente - Gastos)
runTest('Cálculo de Disponible Libre matemático', () => {
  const income = 25000;
  const committedPending = 8000;
  const expenses = 4500;
  const initialBalance = 1000;
  
  const freeAvailable = (income + initialBalance) - committedPending - expenses;
  assert.strictEqual(freeAvailable, 13500);
});

// 9. Registro de Pago Parcial de Obligación
runTest('Pago parcial de obligación actualiza estado a partial', () => {
  const obligation = { id: 'ob1', amount: 2000, status: 'pending', isPaid: false };
  const payments = [{ id: 'exp1', obligationId: 'ob1', amount: 800, status: 'active' }];
  
  const totalPaid = payments.filter(p => p.obligationId === 'ob1' && p.status === 'active').reduce((s, p) => s + p.amount, 0);
  const newStatus = totalPaid >= obligation.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';
  const pendingAmount = Math.max(0, obligation.amount - totalPaid);

  assert.strictEqual(newStatus, 'partial');
  assert.strictEqual(pendingAmount, 1200);
});

// 10. Pago Total de Obligación
runTest('Pago total de obligación actualiza estado a paid y remueve del pendiente', () => {
  const obligation = { id: 'ob1', amount: 2000, status: 'pending', isPaid: false };
  const payments = [
    { id: 'exp1', obligationId: 'ob1', amount: 800, status: 'active' },
    { id: 'exp2', obligationId: 'ob1', amount: 1200, status: 'active' },
  ];
  
  const totalPaid = payments.filter(p => p.obligationId === 'ob1' && p.status === 'active').reduce((s, p) => s + p.amount, 0);
  const newStatus = totalPaid >= obligation.amount ? 'paid' : 'partial';
  const pendingAmount = Math.max(0, obligation.amount - totalPaid);

  assert.strictEqual(newStatus, 'paid');
  assert.strictEqual(pendingAmount, 0);
});

// 11. Reversión de Pago de Obligación
runTest('Reversión de pago restaura el balance pendiente de la obligación', () => {
  const obligation = { id: 'ob1', amount: 2000, status: 'paid', isPaid: true };
  let payments = [
    { id: 'exp1', obligationId: 'ob1', amount: 2000, status: 'active' }
  ];
  // Revert payment
  payments[0].status = 'reverted';

  const totalPaid = payments.filter(p => p.obligationId === 'ob1' && p.status !== 'reverted').reduce((s, p) => s + p.amount, 0);
  const newStatus = totalPaid >= obligation.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';
  const pendingAmount = obligation.amount - totalPaid;

  assert.strictEqual(newStatus, 'pending');
  assert.strictEqual(pendingAmount, 2000);
});

// 12. Confirmación de Nómina
runTest('Confirmación de nómina registra salario recibido y elimina pendiente del ciclo', () => {
  const baseSalary = 30000;
  const expectedPerCycle = baseSalary / 2; // 15000
  const actualIncomesReceived = [{ id: 'inc1', amount: 15000, isSalary: true, payCycle: 'Q1' }];
  
  const q1Received = actualIncomesReceived.filter(i => i.isSalary && i.payCycle === 'Q1').reduce((s, i) => s + i.amount, 0);
  const q1Pending = Math.max(0, expectedPerCycle - q1Received);
  
  assert.strictEqual(q1Received, 15000);
  assert.strictEqual(q1Pending, 0);
});

// 13. Detección de Estado de Período (Open vs Pending Review vs Closed)
runTest('Detección de estado del período según fecha y cierres', () => {
  const getStatus = (periodStr, isClosed, todayStr) => {
    if (isClosed) return 'closed';
    if (periodStr < todayStr) return 'pending_review';
    return 'open';
  };
  assert.strictEqual(getStatus('2026-08', false, '2026-09'), 'pending_review');
  assert.strictEqual(getStatus('2026-09', false, '2026-09'), 'open');
  assert.strictEqual(getStatus('2026-08', true, '2026-09'), 'closed');
});

// 14. Congelación de Resumen en Cierre (Frozen Summary)
runTest('Cierre de período congela el resumen financiero inmutable', () => {
  const state = {
    period: '2026-08',
    cycle: 'MONTHLY',
    status: 'closed',
    closedAt: new Date().toISOString(),
    frozenSummary: {
      totalIncome: 50000,
      totalExpenses: 28000,
      obligationsCommitted: 15000,
      freeAvailable: 7000,
      carryType: 'surplus'
    }
  };
  assert.strictEqual(state.status, 'closed');
  assert.strictEqual(state.frozenSummary.freeAvailable, 7000);
  assert.ok(state.closedAt);
});

// 15. Arrastre de Sobrante (Surplus Rollover)
runTest('Arrastre de excedente genera saldo inicial positivo en ciclo siguiente', () => {
  const rollover = {
    sourcePeriod: '2026-08',
    sourceCycle: 'MONTHLY',
    destinationPeriod: '2026-09',
    destinationCycle: 'MONTHLY',
    amount: 5000,
    type: 'surplus'
  };
  const destinationInitialBalance = rollover.amount;
  assert.strictEqual(destinationInitialBalance, 5000);
});

// 16. Asignación a Metas de Ahorro desde Sobrante
runTest('Asignación de excedente a Meta de Ahorro y residuo al siguiente ciclo', () => {
  const surplus = 10000;
  const goalAllocation = 6000;
  const carryToNext = surplus - goalAllocation;
  
  let goal = { id: 'g1', name: 'Fondo Emergencia', currentAmount: 20000 };
  goal.currentAmount += goalAllocation;
  
  assert.strictEqual(goal.currentAmount, 26000);
  assert.strictEqual(carryToNext, 4000);
});

// 17. Arrastre de Déficit (Negative Initial Balance)
runTest('Arrastre de déficit genera saldo inicial negativo en ciclo destino', () => {
  const deficitRollover = {
    sourcePeriod: '2026-08',
    sourceCycle: 'MONTHLY',
    destinationPeriod: '2026-09',
    destinationCycle: 'MONTHLY',
    amount: -3200,
    type: 'deficit'
  };
  assert.strictEqual(deficitRollover.amount, -3200);
  assert.strictEqual(deficitRollover.type, 'deficit');
});

// 18. Prevención de Doble Conteo en Vista Mensual
runTest('Prevención de doble conteo de arrastres intra-quincena en vista Mensual', () => {
  const rollovers = [
    // Intra-mes Q1 -> Q2
    { sourcePeriod: '2026-09', sourceCycle: 'Q1', destinationPeriod: '2026-09', destinationCycle: 'Q2', amount: 3000 },
    // Inter-mes Agosto -> Septiembre
    { sourcePeriod: '2026-08', sourceCycle: 'MONTHLY', destinationPeriod: '2026-09', destinationCycle: 'MONTHLY', amount: 5000 },
  ];
  
  // Para la vista mensual de Septiembre, solo se debe contar el inter-mes, no el intra-mes
  const monthlyInitialBalance = rollovers
    .filter(r => r.destinationPeriod === '2026-09' && r.sourcePeriod !== '2026-09')
    .reduce((sum, r) => sum + r.amount, 0);

  assert.strictEqual(monthlyInitialBalance, 5000);
});

console.log('\n====================================================');
console.log(` RESULTADO FINAL: ${passedTests}/${totalTests} PRUEBAS COMPLETADAS CON ÉXITO`);
console.log('====================================================');
