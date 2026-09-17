const assert = require('assert');
const { 
  getPayCycle, 
  getLastDayOfMonth, 
  getSafeDueDate, 
  isLeapYear, 
  getPayCycleBounds,
  comparePeriods
} = require('./src/lib/time.js');

function runTests() {
  console.log("Running Phase 1 Time Tests...");

  // 15/01/2026 = Q1
  assert.strictEqual(getPayCycle(new Date(2026, 0, 15)), 'Q1', "15/01/2026 should be Q1");
  
  // 16/01/2026 = Q2
  assert.strictEqual(getPayCycle(new Date(2026, 0, 16)), 'Q2', "16/01/2026 should be Q2");
  
  // 31/01/2026 = Q2
  assert.strictEqual(getPayCycle(new Date(2026, 0, 31)), 'Q2', "31/01/2026 should be Q2");
  
  // Febrero 2026 termina el 28
  assert.strictEqual(getLastDayOfMonth(2026, 2), 28, "Feb 2026 should have 28 days");
  
  // Febrero 2028 termina el 29
  assert.strictEqual(getLastDayOfMonth(2028, 2), 29, "Feb 2028 should have 29 days");
  
  // Abril termina el 30
  assert.strictEqual(getLastDayOfMonth(2026, 4), 30, "April should have 30 days");
  
  // Mayo termina el 31
  assert.strictEqual(getLastDayOfMonth(2026, 5), 31, "May should have 31 days");
  
  // Vencimiento día 31 en febrero se ajusta a 28 o 29
  const safeFeb2026 = getSafeDueDate(2026, 2, 31);
  assert.strictEqual(safeFeb2026.getDate(), 28, "Due date 31 in Feb 2026 should be 28");
  
  const safeFeb2028 = getSafeDueDate(2028, 2, 31);
  assert.strictEqual(safeFeb2028.getDate(), 29, "Due date 31 in Feb 2028 should be 29");
  
  // 31/12/2026 y 01/01/2027 mantienen períodos correctos
  // let's check bounds for periods
  const q2Dec2026 = getPayCycleBounds('2026-12', 'Q2');
  assert.strictEqual(q2Dec2026.end.getDate(), 31, "Q2 Dec 2026 ends on 31");
  assert.strictEqual(q2Dec2026.end.getMonth(), 11, "Q2 Dec 2026 is month 11 (Dec)");
  assert.strictEqual(q2Dec2026.end.getFullYear(), 2026, "Q2 Dec 2026 is year 2026");

  const q1Jan2027 = getPayCycleBounds('2027-01', 'Q1');
  assert.strictEqual(q1Jan2027.start.getDate(), 1, "Q1 Jan 2027 starts on 1");
  assert.strictEqual(q1Jan2027.start.getMonth(), 0, "Q1 Jan 2027 is month 0 (Jan)");
  assert.strictEqual(q1Jan2027.start.getFullYear(), 2027, "Q1 Jan 2027 is year 2027");

  console.log("All Phase 1 tests passed successfully!");
}

try {
  runTests();
} catch (error) {
  console.error("Test failed:", error);
  process.exit(1);
}
