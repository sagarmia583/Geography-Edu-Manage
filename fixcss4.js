const fs = require('fs');
let c = fs.readFileSync('assets/site.css', 'utf8');
c = c + '\n@media (max-width: 900px) { .table-wrap table, .result-output table, .panel-main table, table.excel-table { min-width: 800px !important; } }\n';
fs.writeFileSync('assets/site.css', c);
