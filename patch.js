const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/disponible-hero.tsx', 'utf8');

// Remove Foco de Decision badge
code = code.replace(/<span className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">\s*Foco de Decisión\s*<\/span>\s*<span className="text-surface-300 dark:text-surface-600">·<\/span>/g, '');

// Remove Desglose de la ecuación quincenal entirely
const equationStart = code.indexOf('<p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3">\n          Desglose de la ecuación quincenal\n        </p>');
const equationEnd = code.indexOf('</div>\n      </div>', equationStart);
if (equationStart !== -1 && equationEnd !== -1) {
  code = code.substring(0, equationStart) + code.substring(equationEnd + '</div>\n      </div>'.length);
}

// Remove dailyBudget as it's no longer used
code = code.replace(/const dailyBudget =[\s\S]*?freeAvailable \/ remainingDays : 0;/g, '');

fs.writeFileSync('src/components/dashboard/disponible-hero.tsx', code);
