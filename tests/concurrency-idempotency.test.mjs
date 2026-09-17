import assert from 'assert';
import { createIsolatedTestStore } from './isolated-store-engine.mjs';

export async function runConcurrencyIdempotencyTests() {
  const results = [];

  // 12. F5 o reinicialización repetida no genera duplicados
  {
    const store = createIsolatedTestStore();
    const tpl = await store.addRecurringObligation({
      name: 'Seguro Médico',
      amount: 4500,
      category: 'health',
      dayOfMonth: 15,
      payCycle: 'Q1',
      startDate: '2026-01-01',
    });

    // Simular inicialización 1
    await store.generatePeriodObligations('2026-09');
    const countAfter1 = store.state.obligations.length;

    // Simular inicialización repetida (F5 o refresh)
    await store.generatePeriodObligations('2026-09');
    await store.generatePeriodObligations('2026-09');
    const countAfter3 = store.state.obligations.length;

    assert.strictEqual(countAfter1, 1);
    assert.strictEqual(countAfter3, 1, 'Múltiples pasadas de inicialización deben mantener exactamente 1 instancia');

    results.push({
      testId: 12,
      suite: 'Concurrency/Idempotency',
      name: 'F5 o reinicialización repetida no genera duplicados',
      passed: true,
      expected: '1 instancia única',
      actual: `Total instances=${countAfter3}`,
    });
  }

  // 13. Inicializar varias veces una plantilla y período crea una sola instancia
  {
    const store = createIsolatedTestStore();
    const tpl = await store.addRecurringObligation({
      name: 'Colegiatura',
      amount: 15000,
      category: 'education',
      dayOfMonth: 5,
      payCycle: 'Q1',
      startDate: '2026-01-01',
    });

    const res1 = await store.generatePeriodObligations('2026-09');
    const res2 = await store.generatePeriodObligations('2026-09');
    const res3 = await store.generatePeriodObligations('2026-09');

    assert.strictEqual(res1.created, 1);
    assert.strictEqual(res2.created, 0);
    assert.strictEqual(res2.alreadyExisted, 1);
    assert.strictEqual(res3.created, 0);
    assert.strictEqual(res3.alreadyExisted, 1);

    results.push({
      testId: 13,
      suite: 'Concurrency/Idempotency',
      name: 'Inicializar varias veces una plantilla y período crea una sola instancia',
      passed: true,
      expected: 'created=1 en 1ra pasada, alreadyExisted=1 en 2da y 3ra',
      actual: `Pass1(created=${res1.created}), Pass2(already=${res2.alreadyExisted}), Pass3(already=${res3.alreadyExisted})`,
    });
  }

  // 14. Dos solicitudes simultáneas crean una sola instancia
  {
    const store = createIsolatedTestStore();
    const tpl = await store.addRecurringObligation({
      name: 'Servicio de Nube',
      amount: 1200,
      category: 'utilities',
      dayOfMonth: 12,
      payCycle: 'Q1',
      startDate: '2026-01-01',
    });

    // Fire in parallel
    const [resA, resB] = await Promise.all([
      store.generatePeriodObligations('2026-09'),
      store.generatePeriodObligations('2026-09'),
    ]);

    const matching = store.state.obligations.filter((o) => o.templateId === tpl.id && o.period === '2026-09');
    assert.strictEqual(matching.length, 1, 'Exactamente 1 instancia creada a pesar de ejecución simultánea');

    results.push({
      testId: 14,
      suite: 'Concurrency/Idempotency',
      name: 'Dos solicitudes simultáneas crean una sola instancia',
      passed: true,
      expected: '1 instancia creada en paralelo',
      actual: `Matching obligations=${matching.length}`,
    });
  }

  return results;
}

if (process.argv[1].endsWith('concurrency-idempotency.test.mjs')) {
  console.log('Running Concurrency & Idempotency Tests...');
  runConcurrencyIdempotencyTests().then((res) => {
    console.table(res);
    console.log(`Passed ${res.length} concurrency & idempotency tests.`);
  });
}
