const fs = require('fs');
let c = fs.readFileSync('assets/site.css', 'utf8');
c = c.replace(/html, body \{ overflow-x: hidden !important; max-width: 100vw !important; \}/g, 'html, body { overflow-x: hidden !important; width: 100% !important; max-width: 100% !important; position: relative; } * { box-sizing: border-box; }');
fs.writeFileSync('assets/site.css', c);
