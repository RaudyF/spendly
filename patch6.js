const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/dashboard-page.tsx', 'utf8');

// Ensure Completa tu resumen has w-full and no h-full forcing if it's bad, though h-full is fine for a single row item.
code = code.replace(
  '<Card key="completa-resumen" className="p-6 flex flex-col justify-between h-full">',
  '<Card key="completa-resumen" className="p-6 flex flex-col justify-between w-full">'
);

// Apply items-start to grid layouts to allow independent heights
const layoutsToUpdate = [
  'className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0 overflow-hidden"',
  'className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full min-w-0 overflow-hidden"',
  'className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto w-full min-w-0 overflow-hidden"'
];

layoutsToUpdate.forEach(layout => {
  const newLayout = layout.replace('gap-4 sm:gap-6', 'gap-4 sm:gap-6 items-start');
  code = code.replaceAll(layout, newLayout);
});

// Also fix the main bottom row rendering to be responsive and correct.
// We should make sure md:col-span-2 is actually col-span-1 md:col-span-2 or col-span-full
code = code.replace(
  'className="md:col-span-2 w-full min-w-0 overflow-hidden"',
  'className="col-span-1 md:col-span-2 w-full min-w-0 overflow-hidden"'
);
code = code.replace(
  'className="md:col-span-2 max-w-xl mx-w-full w-full min-w-0 overflow-hidden"',
  'className="col-span-1 md:col-span-2 w-full min-w-0 overflow-hidden"'
);

fs.writeFileSync('src/components/dashboard/dashboard-page.tsx', code);
