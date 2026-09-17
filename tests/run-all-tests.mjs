import { runUnitTests } from './calendar-unit.test.mjs';
import { runStoreActionTests } from './store-actions.test.mjs';
import { runClosingRolloverTests } from './closing-rollover.test.mjs';
import { runConcurrencyIdempotencyTests } from './concurrency-idempotency.test.mjs';
import { runMigrationTests } from './migration-persistence.test.mjs';
import { runApiSyncSecurityTests } from './api-sync-security.test.mjs';
import { runOfflineSyncTests } from './offline-sync.test.mjs';

async function runAllTests() {
  console.log('===============================================================');
  console.log(' SALDOCLARO - SUITE DE VALIDACIÓN INTEGRAL Y SEGURIDAD');
  console.log('===============================================================');
  console.log('Aislamiento: Base de datos local/remota NO modificada.');
  console.log('Ejecutando pruebas de motor temporal, financiero, seguridad y offline-first sync...\n');

  const unitResults = runUnitTests();
  const storeResults = await runStoreActionTests();
  const closingResults = await runClosingRolloverTests();
  const concurrencyResults = await runConcurrencyIdempotencyTests();
  const migrationResults = runMigrationTests();
  const securityResults = await runApiSyncSecurityTests();
  const offlineResults = await runOfflineSyncTests();

  const allResults = [
    ...unitResults,
    ...storeResults,
    ...closingResults,
    ...concurrencyResults,
    ...migrationResults,
    ...securityResults,
    ...offlineResults,
  ];

  console.table(
    allResults.map((r) => ({
      '#': r.testId,
      Suite: r.suite,
      Prueba: r.name,
      Resultado: r.passed ? 'PASSED' : 'FAILED',
      Detalle: r.actual,
    }))
  );

  const passedCount = allResults.filter((r) => r.passed).length;
  const failedCount = allResults.length - passedCount;

  console.log('\n---------------------------------------------------------------');
  console.log(`TOTAL EJECUTADAS: ${allResults.length}`);
  console.log(`PASARON:          ${passedCount}`);
  console.log(`FALLARON:         ${failedCount}`);
  console.log('---------------------------------------------------------------');

  if (failedCount > 0) {
    console.error('ALERTA: Se detectaron pruebas fallidas.');
    process.exit(1);
  } else {
    console.log(`EXITO: Todas las ${allResults.length} pruebas pasaron satisfactoriamente (Código 0).`);
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Error fatal al ejecutar la suite:', err);
  process.exit(1);
});
