const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/dashboard-page.tsx', 'utf8');

code = code.replace(
  'className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto"',
  'className="p-4 lg:p-8 pb-32 lg:pb-12 space-y-6 max-w-7xl mx-auto"'
);

fs.writeFileSync('src/components/dashboard/dashboard-page.tsx', code);
