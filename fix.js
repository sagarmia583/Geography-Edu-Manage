const fs = require('fs');
const path = require('path');
const dir = 'f:/Geography-Edu-Manage-main/Geography-Edu-Manage-main/admin';
fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
  let fp = path.join(dir, f);
  let c = fs.readFileSync(fp, 'utf8');
  let original = c;
  c = c.replace(/style=.display:none!important./g, '');
  if (c !== original) {
    fs.writeFileSync(fp, c);
    console.log('Fixed:', f);
  }
});
