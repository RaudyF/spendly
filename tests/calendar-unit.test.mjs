import assert from 'assert';

// Standalone Pure Calendar & Financial Unit Implementations mirroring src/lib
const FINANCIAL_ZONE = 'America/Santo_Domingo';

export function getPayCycleFromDate(date) {
  const day = typeof date === 'string' ? parseInt(date.split('-')[2] || date.slice(8, 10), 10) : date.getDate();
  return day <= 15 ? 'Q1' : 'Q2';
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function getPayCycle(date) {
  return date.getDate() <= 15 ? 'Q1' : 'Q2';
}

export function calculateSafeDueDateString(period, dayOfMonth) {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayOfMonth), lastDay);
  return `${period}-${String(safeDay).padStart(2, '0')}`;
}

export function getSafeDueDate(year, month, targetDay) {
  const lastDay = getLastDayOfMonth(year, month);
  const safeDay = targetDay > lastDay ? lastDay : targetDay;
  return new Date(year, month - 1, safeDay);
}

export function getNextMonthPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  const nextDate = new Date(year, month, 1);
  const y = nextDate.getFullYear();
  const m = String(nextDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getPreviousMonthPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const y = prevDate.getFullYear();
  const m = String(prevDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function comparePeriods(p1, p2) {
  const [y1, m1] = p1.split('-').map(Number);
  const [y2, m2] = p2.split('-').map(Number);
  if (y1 !== y2) return y1 < y2 ? -1 : 1;
  if (m1 !== m2) return m1 < m2 ? -1 : 1;
  return 0;
}

export function getObligationPaidAmount(obligationId, expenses) {
  return expenses
    .filter((e) => e.obligationId === obligationId && e.status !== 'reverted')
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getObligationRemainingAmount(obligation, expenses) {
  if (obligation.status === 'cancelled' || obligation.status === 'paid') return 0;
  if (obligation.isPaid && !obligation.status) return 0;
  const paid = getObligationPaidAmount(obligation.id, expenses);
  return Math.max(0, obligation.amount - paid);
}

export function runUnitTests() {
  const results = [];

  // 1. Día 15 pertenece a Q1 y día 16 pertenece a Q2
  {
    const d15 = new Date(2026, 8, 15); // 2026-09-15
    const d16 = new Date(2026, 8, 16); // 2026-09-16
    const cycle15 = getPayCycle(d15);
    const cycle16 = getPayCycle(d16);
    const cycle15Str = getPayCycleFromDate('2026-09-15');
    const cycle16Str = getPayCycleFromDate('2026-09-16');

    assert.strictEqual(cycle15, 'Q1', 'Día 15 debe pertenecer a Q1 (Date)');
    assert.strictEqual(cycle16, 'Q2', 'Día 16 debe pertenecer a Q2 (Date)');
    assert.strictEqual(cycle15Str, 'Q1', 'Día 15 debe pertenecer a Q1 (string)');
    assert.strictEqual(cycle16Str, 'Q2', 'Día 16 debe pertenecer a Q2 (string)');

    results.push({
      testId: 1,
      suite: 'Unit/Calendar',
      name: 'Día 15 pertenece a Q1 y día 16 pertenece a Q2',
      passed: true,
      expected: '15 -> Q1, 16 -> Q2',
      actual: `${cycle15Str} / ${cycle16Str}`,
    });
  }

  // 2. Febrero de 2026 tiene 28 días
  {
    const daysFeb2026 = getLastDayOfMonth(2026, 2);
    const isLeap2026 = isLeapYear(2026);
    assert.strictEqual(daysFeb2026, 28, 'Febrero 2026 debe tener 28 días');
    assert.strictEqual(isLeap2026, false, '2026 no es bisiesto');

    results.push({
      testId: 2,
      suite: 'Unit/Calendar',
      name: 'Febrero de 2026 tiene 28 días',
      passed: true,
      expected: '28 días, no bisiesto',
      actual: `${daysFeb2026} días, leap=${isLeap2026}`,
    });
  }

  // 3. Febrero de 2028 tiene 29 días
  {
    const daysFeb2028 = getLastDayOfMonth(2028, 2);
    const isLeap2028 = isLeapYear(2028);
    assert.strictEqual(daysFeb2028, 29, 'Febrero 2028 debe tener 29 días');
    assert.strictEqual(isLeap2028, true, '2028 es bisiesto');

    results.push({
      testId: 3,
      suite: 'Unit/Calendar',
      name: 'Febrero de 2028 tiene 29 días',
      passed: true,
      expected: '29 días, bisiesto',
      actual: `${daysFeb2028} días, leap=${isLeap2028}`,
    });
  }

  // 4. Una obligación del día 31 vence el último día válido de febrero
  {
    const dueFeb2026 = calculateSafeDueDateString('2026-02', 31);
    const dueFeb2028 = calculateSafeDueDateString('2028-02', 31);
    const safeDateObj = getSafeDueDate(2026, 2, 31);

    assert.strictEqual(dueFeb2026, '2026-02-28', 'Día 31 en feb 2026 debe dar 2026-02-28');
    assert.strictEqual(dueFeb2028, '2028-02-29', 'Día 31 en feb 2028 debe dar 2028-02-29');
    assert.strictEqual(safeDateObj.getDate(), 28, 'Safe date object must clamp to 28');

    results.push({
      testId: 4,
      suite: 'Unit/Calendar',
      name: 'Una obligación del día 31 vence el último día válido de febrero',
      passed: true,
      expected: '2026-02-28 y 2028-02-29',
      actual: `${dueFeb2026} y ${dueFeb2028}`,
    });
  }

  // 5. Abril termina el día 30 y mayo el día 31
  {
    const daysApr = getLastDayOfMonth(2026, 4);
    const daysMay = getLastDayOfMonth(2026, 5);
    const dueApr31 = calculateSafeDueDateString('2026-04', 31);
    const dueMay31 = calculateSafeDueDateString('2026-05', 31);

    assert.strictEqual(daysApr, 30, 'Abril debe tener 30 días');
    assert.strictEqual(daysMay, 31, 'Mayo debe tener 31 días');
    assert.strictEqual(dueApr31, '2026-04-30', 'Día 31 en abril debe dar 2026-04-30');
    assert.strictEqual(dueMay31, '2026-05-31', 'Día 31 en mayo debe dar 2026-05-31');

    results.push({
      testId: 5,
      suite: 'Unit/Calendar',
      name: 'Abril termina el día 30 y mayo el día 31',
      passed: true,
      expected: 'Abril: 30, Mayo: 31',
      actual: `Abril: ${daysApr} (${dueApr31}), Mayo: ${daysMay} (${dueMay31})`,
    });
  }

  // 6. Diciembre de 2026 cambia correctamente a enero de 2027
  {
    const nextPeriod = getNextMonthPeriod('2026-12');
    const prevPeriod = getPreviousMonthPeriod('2027-01');
    const comp = comparePeriods('2026-12', '2027-01');

    assert.strictEqual(nextPeriod, '2027-01', 'Siguiente mes tras 2026-12 debe ser 2027-01');
    assert.strictEqual(prevPeriod, '2026-12', 'Mes anterior a 2027-01 debe ser 2026-12');
    assert.strictEqual(comp, -1, '2026-12 debe ser menor que 2027-01');

    results.push({
      testId: 6,
      suite: 'Unit/Calendar',
      name: 'Diciembre de 2026 cambia correctamente a enero de 2027',
      passed: true,
      expected: '2026-12 -> 2027-01 (next) y 2027-01 -> 2026-12 (prev)',
      actual: `${nextPeriod} / ${prevPeriod}`,
    });
  }

  return results;
}

if (process.argv[1].endsWith('calendar-unit.test.mjs')) {
  console.log('Running Calendar & Pure Unit Tests...');
  const res = runUnitTests();
  console.table(res);
  console.log(`Passed ${res.length} unit tests.`);
}
