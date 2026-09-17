const fs = require('fs');
let c = fs.readFileSync('assets/site.css', 'utf8');
c = c.replace(/width: 100vw !important; max-width: 100vw !important;/g, 'width: 100% !important; max-width: 100% !important;');
c = c.replace(/max-width: 100vw !important;/g, 'max-width: 100% !important;');
fs.writeFileSync('assets/site.css', c);
