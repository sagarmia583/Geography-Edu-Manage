const fs = require('fs');
let c = fs.readFileSync('assets/site.css', 'utf8');
c = c.replace(/\* \{ box-sizing: border-box; \}/g, '');
fs.writeFileSync('assets/site.css', c);
