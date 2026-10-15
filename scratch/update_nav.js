const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('admin').filter(f => f.endsWith('.html'));
let updatedCount = 0;

files.forEach(f => {
  if (f === 'blank-marksheet-print.html') return;
  const p = path.join('admin', f);
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;

  // 1. Sidebar Panel Menu
  if (content.includes('panel-menu') && !content.includes('blank-marksheet-print.html')) {
    const reg = /(<a\s+[^>]*href=["']marks-entry\.html["'][^>]*>[\s\S]*?<\/a>)/i;
    if (reg.test(content)) {
      content = content.replace(reg, '$1<a href="blank-marksheet-print.html">🖨️ Blank Marksheet</a>');
      changed = true;
    }
  }

  // 2. Mobile Tabs (if present and missing)
  if (content.includes('panel-mobile-tabs') && !content.includes('href="blank-marksheet-print.html"')) {
    const mobileReg = /(<div\s+class=["']panel-mobile-tabs[^"']*["']>[\s\S]*?<a\s+[^>]*href=["']marks-entry\.html["'][^>]*>[\s\S]*?<\/a>)/i;
    if (mobileReg.test(content)) {
      content = content.replace(mobileReg, '$1<a href="blank-marksheet-print.html">Blank Marksheet</a>');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(p, content, 'utf8');
    updatedCount++;
    console.log('Updated nav in:', f);
  }
});

console.log('Finished updating files. Total updated:', updatedCount);
