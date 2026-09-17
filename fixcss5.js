const fs = require('fs');
let c = fs.readFileSync('assets/site.css', 'utf8');
c = c + '\n@media (max-width: 900px) { .panel-main { margin-left: 0 !important; width: 100vw !important; max-width: 100vw !important; padding: 10px !important; } .topbar .inner { padding: 0 10px !important; } }\n';
fs.writeFileSync('assets/site.css', c);
