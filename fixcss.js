const fs = require('fs');
let c = fs.readFileSync('assets/site.css', 'utf8');
c = c.replace('@media (max-width: 900px) {', '@media (max-width: 900px) {\n  html, body { overflow-x: hidden !important; max-width: 100vw !important; }\n');
fs.writeFileSync('assets/site.css', c);
