const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/dashboard-page.tsx', 'utf8');

const oldThreeModules = `        if (modules.length === 3) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">
              <div className="min-w-0 overflow-hidden">{modules[0]}</div>
              <div className="min-w-0 overflow-hidden">{modules[1]}</div>
              <div className="md:col-span-2 max-w-xl mx-w-full w-full min-w-0 overflow-hidden">
                {modules[2]}
              </div>
            </div>
          );
        }`;

const newThreeModules = `        if (modules.length === 3) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full min-w-0 overflow-hidden">
              <div className="min-w-0 overflow-hidden">{modules[0]}</div>
              <div className="min-w-0 overflow-hidden">{modules[1]}</div>
              <div className="md:col-span-2 w-full min-w-0 overflow-hidden">
                {modules[2]}
              </div>
            </div>
          );
        }`;

if (code.includes(oldThreeModules)) {
  code = code.replace(oldThreeModules, newThreeModules);
} else {
  console.log("Could not find three modules pattern exactly");
}

fs.writeFileSync('src/components/dashboard/dashboard-page.tsx', code);
