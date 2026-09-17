const fs = require('fs');
let c = fs.readFileSync('assets/site.css', 'utf8');
c = c + '\n@media (max-width: 900px) { .topbar .mobile-menu, button.mobile-menu, .admin-topbar-menu-hidden { display: block !important; opacity: 1 !important; visibility: visible !important; width: 40px !important; height: 40px !important; z-index: 99999 !important; } }\n';
fs.writeFileSync('assets/site.css', c);
