import assert from 'assert';
import { createIsolatedTestStore } from './isolated-store-engine.mjs';

export async function runStoreActionTests() {
  const results = [];

  // 7. Ingreso recibido el día 14 y asignado a Q2 aparece solo en Q2 y Mes
  {
    const store = createIsolatedTestStore();
    // Injected: income with actual date 2026-09-14 but payCycle='Q2'
    await store.addIncome({
      amount: 12000,
      date: '2026-09-14',
      payCycle: 'Q2',
      type: 'additional',
      description: 'Consultoría asignada a Q2',
    });

    const q1Summary = store.calculatePeriodSummary('2026-09', 'Q1');
    const q2Summary = store.calculatePeriodSummary('2026-09', 'Q2');
    const monthSummary = store.calculatePeriodSummary('2026-09', 'MONTHLY');

    assert.strictEqual(q1Summary.additionalReceived, 0, 'No debe figurar en Q1');
    assert.strictEqual(q2Summary.additionalReceived, 12000, 'Debe figurar en Q2');
    assert.strictEqual(monthSummary.additionalReceived, 12000, 'Debe figurar en Mes');

    results.push({
      testId: 7,
      suite: 'Store/Finances',
      name: 'Ingreso recibido el día 14 y asignado a Q2 aparece solo en Q2 y Mes',
      passed: true,
      expected: 'Q1: 0, Q2: 12000, Mes: 12000',
      actual: `Q1: ${q1Summary.additionalReceived}, Q2: ${q2Summary.additionalReceived}, Mes: ${monthSummary.additionalReceived}`,
    });
  }

  // 8. Pago realizado el día 16 y asignado a Q1 aparece solo en Q1 y Mes
  {
    const store = createIsolatedTestStore();
    const ob = await store.addObligation({
      name: 'Tarjeta Oro',
      amount: 8000,
      payCycle: 'Q1',
      period: '2026-09',
      dueDate: '2026-09-15',
    });

    // Pay on Sept 16, but assign to Q1 & period 2026-09
    await store.registerPayment(ob.id, 8000, '2026-09-16', 'Q1', '2026-09');

    const q1Summary = store.calculatePeriodSummary('2026-09', 'Q1');
    const q2Summary = store.calculatePeriodSummary('2026-09', 'Q2');
    const monthSummary = store.calculatePeriodSummary('2026-09', 'MONTHLY');

    assert.strictEqual(q1Summary.totalExpenses, 8000, 'Debe registrarse en Q1');
    assert.strictEqual(q2Summary.totalExpenses, 0, 'No debe registrarse en Q2');
    assert.strictEqual(monthSummary.totalExpenses, 8000, 'Debe registrarse en Mes');

    results.push({
      testId: 8,
      suite: 'Store/Finances',
      name: 'Pago realizado el día 16 y asignado a Q1 aparece solo en Q1 y Mes',
      passed: true,
      expected: 'Q1: 8000, Q2: 0, Mes: 8000',
      actual: `Q1: ${q1Summary.totalExpenses}, Q2: ${q2Summary.totalExpenses}, Mes: ${monthSummary.totalExpenses}`,
    });
  }

  // 9. Pago parcial seguido de pago final recalcula pagado, pendiente, gasto y comprometido
  {
    const store = createIsolatedTestStore();
    const ob = await store.addObligation({
      name: 'Préstamo Auto',
      amount: 10000,
      payCycle: 'Q1',
      period: '2026-09',
      dueDate: '2026-09-15',
    });

    // Step 1: Pago parcial de 4000 (evaluated on 2026-09-06 before dueDate)
    const p1 = await store.registerPayment(ob.id, 4000, '2026-09-05', 'Q1', '2026-09');
    let paid = store.getObligationPaidAmount(ob.id);
    let rem = store.getObligationRemainingAmount(ob);
    let status = store.calculateObligationEffectiveStatus(ob, '2026-09-06');

    assert.strictEqual(paid, 4000, 'Pagado debe ser 4000');
    assert.strictEqual(rem, 6000, 'Pendiente debe ser 6000');
    assert.strictEqual(status, 'partial', 'Estado debe ser partial');

    let sum1 = store.calculatePeriodSummary('2026-09', 'Q1');
    assert.strictEqual(sum1.totalExpenses, 4000);

    // Step 2: Pago final de 6000
    const p2 = await store.registerPayment(ob.id, 6000, '2026-09-08', 'Q1', '2026-09');
    paid = store.getObligationPaidAmount(ob.id);
    rem = store.getObligationRemainingAmount(ob);
    status = store.calculateObligationEffectiveStatus(ob, '2026-09-09');

    assert.strictEqual(paid, 10000, 'Pagado total debe ser 10000');
    assert.strictEqual(rem, 0, 'Pendiente debe ser 0');
    assert.strictEqual(status, 'paid', 'Estado debe ser paid');

    let sum2 = store.calculatePeriodSummary('2026-09', 'Q1');
    assert.strictEqual(sum2.totalExpenses, 10000, 'Gasto total debe ser 10000');

    results.push({
      testId: 9,
      suite: 'Store/Finances',
      name: 'Pago parcial seguido de pago final recalcula pagado, pendiente, gasto y comprometido',
      passed: true,
      expected: 'Parcial: 4k/6k -> Final: 10k/0k, status=paid, expenses=10k',
      actual: `Paid=${paid}, Rem=${rem}, Status=${status}, Expenses=${sum2.totalExpenses}`,
    });
  }

  // 10. Revertir un pago restaura el saldo sin afectar otros pagos
  {
    const store = createIsolatedTestStore();
    const ob = await store.addObligation({
      name: 'Mantenimiento',
      amount: 5000,
      payCycle: 'Q1',
      period: '2026-09',
    });

    const exp1 = await store.registerPayment(ob.id, 2000, '2026-09-02', 'Q1', '2026-09');
    const exp2 = await store.registerPayment(ob.id, 3000, '2026-09-05', 'Q1', '2026-09');

    assert.strictEqual(store.getObligationPaidAmount(ob.id), 5000);
    assert.strictEqual(store.calculateObligationEffectiveStatus(ob), 'paid');

    // Revert exp2 (3000)
    await store.revertPayment(exp2.id);

    const paidAfter = store.getObligationPaidAmount(ob.id);
    const remAfter = store.getObligationRemainingAmount(ob);
    const statusAfter = store.calculateObligationEffectiveStatus(ob);
    const sumAfter = store.calculatePeriodSummary('2026-09', 'Q1');

    assert.strictEqual(paidAfter, 2000, 'Pagado restante debe ser 2000');
    assert.strictEqual(remAfter, 3000, 'Pendiente debe ser 3000');
    assert.strictEqual(statusAfter, 'partial', 'Estado debe volver a partial');
    assert.strictEqual(sumAfter.totalExpenses, 2000, 'Gastos activos debe ser 2000');

    results.push({
      testId: 10,
      suite: 'Store/Finances',
      name: 'Revertir un pago restaura el saldo sin afectar otros pagos',
      passed: true,
      expected: 'Paid=2000, Rem=3000, Status=partial, Expense=2000',
      actual: `Paid=${paidAfter}, Rem=${remAfter}, Status=${statusAfter}, Expense=${sumAfter.totalExpenses}`,
    });
  }

  // 11. Obligación vencida con saldo pendiente se marca como overdue
  {
    const store = createIsolatedTestStore();
    const ob = await store.addObligation({
      name: 'Factura Internet',
      amount: 2500,
      payCycle: 'Q1',
      period: '2026-09',
      dueDate: '2026-09-10',
    });

    // Simulated evaluation on Sept 17 (today > dueDate 10)
    const status = store.calculateObligationEffectiveStatus(ob, '2026-09-17');
    assert.strictEqual(status, 'overdue', 'Debe marcarse como overdue si dueDate < hoy y tiene saldo');

    // If fully paid, should be 'paid', not 'overdue'
    await store.registerPayment(ob.id, 2500, '2026-09-18', 'Q1', '2026-09');
    const statusPaid = store.calculateObligationEffectiveStatus(ob, '2026-09-17');
    assert.strictEqual(statusPaid, 'paid', 'Si está pagada, su estado debe ser paid');

    results.push({
      testId: 11,
      suite: 'Store/Finances',
      name: 'Obligación vencida con saldo pendiente se marca como overdue',
      passed: true,
      expected: 'overdue cuando está impaga y vencida, paid cuando se paga',
      actual: `${status} -> ${statusPaid}`,
    });
  }

  // 15. Editar una instancia generada no modifica la plantilla ni otros períodos
  {
    const store = createIsolatedTestStore();
    const tpl = await store.addRecurringObligation({
      name: 'Gimnasio',
      amount: 2000,
      category: 'health',
      dayOfMonth: 5,
      payCycle: 'Q1',
      startDate: '2026-01-01',
    });

    // Generate for Sept and Oct
    await store.generatePeriodObligations('2026-09');
    await store.generatePeriodObligations('2026-10');

    const sepOb = store.state.obligations.find((o) => o.templateId === tpl.id && o.period === '2026-09');
    const octOb = store.state.obligations.find((o) => o.templateId === tpl.id && o.period === '2026-10');

    // Mutate instance in Sept
    sepOb.amount = 2500;
    sepOb.name = 'Gimnasio + Entrenador';

    assert.strictEqual(tpl.amount, 2000, 'Plantilla debe mantener amount=2000');
    assert.strictEqual(tpl.name, 'Gimnasio', 'Plantilla debe mantener nombre');
    assert.strictEqual(octOb.amount, 2000, 'Instancia de octubre debe mantener 2000');
    assert.strictEqual(sepOb.amount, 2500, 'Instancia de septiembre se modifica a 2500');

    results.push({
      testId: 15,
      suite: 'Store/Recurrence',
      name: 'Editar una instancia recurrente no modifica la plantilla ni otros períodos',
      passed: true,
      expected: 'Tpl: 2000, Oct: 2000, Sep: 2500',
      actual: `Tpl=${tpl.amount}, Oct=${octOb.amount}, Sep=${sepOb.amount}`,
    });
  }

  // 28. Cambiar de mes no modifica el histórico
  {
    const store = createIsolatedTestStore();
    await store.addExpense({
      amount: 3500,
      date: '2026-08-10',
      financialPeriod: '2026-08',
      payCycle: 'Q1',
      category: 'food',
      description: 'Supermercado Agosto',
    });

    const augSummaryBefore = store.calculatePeriodSummary('2026-08', 'MONTHLY');

    // Simulate navigation by calculating Sept & Oct summaries and adding new expenses in Sept
    await store.addExpense({
      amount: 5000,
      date: '2026-09-12',
      financialPeriod: '2026-09',
      payCycle: 'Q1',
      category: 'food',
      description: 'Supermercado Septiembre',
    });

    const augSummaryAfter = store.calculatePeriodSummary('2026-08', 'MONTHLY');
    const sepSummary = store.calculatePeriodSummary('2026-09', 'MONTHLY');

    assert.strictEqual(augSummaryBefore.totalExpenses, 3500);
    assert.strictEqual(augSummaryAfter.totalExpenses, 3500, 'Gastos de agosto no deben alterarse');
    assert.strictEqual(sepSummary.totalExpenses, 5000, 'Gastos de septiembre calculados independientemente');

    results.push({
      testId: 28,
      suite: 'Store/Navigation',
      name: 'Cambiar de mes no modifica el histórico',
      passed: true,
      expected: 'Agosto: 3500 inalterado, Septiembre: 5000',
      actual: `Aug=${augSummaryAfter.totalExpenses}, Sep=${sepSummary.totalExpenses}`,
    });
  }

  return results;
}

if (process.argv[1].endsWith('store-actions.test.mjs')) {
  console.log('Running Store & Financial Actions Tests...');
  runStoreActionTests().then((res) => {
    console.table(res);
    console.log(`Passed ${res.length} store action tests.`);
  });
}
