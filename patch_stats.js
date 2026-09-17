const fs = require('fs');
let code = fs.readFileSync('src/store/actions/stats-actions.ts', 'utf8');

const helper = `
export function getObligationRemaining(o: import('@/types').Obligation, expenses: import('@/types').Expense[]): number {
  if (o.status === 'paid' || o.status === 'cancelled') return 0;
  if (o.isPaid && !o.status) return 0;
  const paid = expenses
    .filter(e => e.obligationId === o.id && e.status !== 'reverted')
    .reduce((sum, e) => sum + e.amount, 0);
  return Math.max(0, o.amount - paid);
}
`;

code = code.replace("export function isSalaryIncome", helper + "\nexport function isSalaryIncome");

code = code.replace(/const committed = activeObligations\.filter\(\(o\) => !o\.isPaid\)\.reduce\(\(sum, o\) => sum \+ o\.amount, 0\);/g, 
  "const committed = activeObligations.reduce((sum, o) => sum + getObligationRemaining(o, expenses), 0);");

code = code.replace(/const q1Committed = obligations\s*\.filter\(\(o\) => !o\.isPaid && o\.payCycle === 'Q1'\)\s*\.reduce\(\(sum, o\) => sum \+ o\.amount, 0\);/g, 
  "const q1Committed = obligations.filter(o => o.payCycle === 'Q1').reduce((sum, o) => sum + getObligationRemaining(o, expenses), 0);");

code = code.replace(/const q2Committed = obligations\s*\.filter\(\(o\) => !o\.isPaid && o\.payCycle === 'Q2'\)\s*\.reduce\(\(sum, o\) => sum \+ o\.amount, 0\);/g, 
  "const q2Committed = obligations.filter(o => o.payCycle === 'Q2').reduce((sum, o) => sum + getObligationRemaining(o, expenses), 0);");

fs.writeFileSync('src/store/actions/stats-actions.ts', code);
