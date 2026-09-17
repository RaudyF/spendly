const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/dashboard-page.tsx', 'utf8');

code = code.replace(
  '        modules.push(<BudgetOverview key="budget" />);',
  `        const hasBudgets = budgets.some((b) => b.month === currentMonth);
        if (hasBudgets) {
          modules.push(<BudgetOverview key="budget" />);
        }`
);

fs.writeFileSync('src/components/dashboard/dashboard-page.tsx', code);
