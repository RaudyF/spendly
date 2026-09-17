const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/disponible-hero.tsx', 'utf8');

code = code.replace(/<\/p>\s*<\/div>\s*{\/\* Compact Salary Notification if Pending \*\//, '</p>\n        </div>\n      </div>\n\n      {/* Compact Salary Notification if Pending */');

fs.writeFileSync('src/components/dashboard/disponible-hero.tsx', code);
