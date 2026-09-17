const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/dashboard-page.tsx', 'utf8');

code = code.replace(
  '        const hasBudgets = budgets.some((b) => b.month === currentMonth);',
  '        const hasBudgets = (useStore.getState().budgets || []).some((b) => b.month === currentMonth);'
);

fs.writeFileSync('src/components/dashboard/dashboard-page.tsx', code);
