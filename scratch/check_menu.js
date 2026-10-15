const fs = require('fs');
const files = fs.readdirSync('admin').filter(f => f.endsWith('.html'));
let count = 0;
const missing = [];
files.forEach(f => {
  const p = 'admin/' + f;
  const content = fs.readFileSync(p, 'utf8');
  if (content.includes('panel-menu') && !content.includes('blank-marksheet-print.html')) {
    count++;
    missing.push(f);
  }
});
console.log('Total files missing blank-marksheet-print.html:', count);
console.log(missing);
