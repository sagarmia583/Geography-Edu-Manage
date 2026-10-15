const fs = require('fs');
const http = require('http');

console.log('--- 1. Testing blank-marksheet-print.html structure ---');
const html = fs.readFileSync('admin/blank-marksheet-print.html', 'utf8');

const requiredIds = [
  'sessionYear', 'academicYear', 'examSelect', 'subjectSelect',
  'sortField', 'sortDir', 'statusBox', 'printArea',
  'extraBlankRowsSelect', 'studentTypeFilter', 'quickPrintBtn', 'downloadCsvBtn'
];

let missingIds = [];
requiredIds.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    missingIds.push(id);
  }
});

if (missingIds.length) {
  console.error('ERROR: Missing required IDs in HTML:', missingIds);
} else {
  console.log('SUCCESS: All required DOM IDs present in blank-marksheet-print.html.');
}

// Check scripts included
if (html.includes('geography-api.js') && html.includes('site.js') && html.includes('requireAuth(\'admin\')')) {
  console.log('SUCCESS: Auth and API scripts properly included.');
} else {
  console.error('ERROR: Missing scripts or auth in blank-marksheet-print.html');
}

// Check print CSS
if (html.includes('@media print') && html.includes('.blank-sheet-page') && html.includes('.blank-sheet-table')) {
  console.log('SUCCESS: Print CSS rules and media queries present.');
} else {
  console.error('ERROR: Missing print CSS rules.');
}

console.log('\n--- 2. Testing HTTP server response for blank-marksheet-print.html ---');
http.get('http://localhost:3000/admin/blank-marksheet-print.html', (res) => {
  console.log('HTTP Status:', res.statusCode);
  if (res.statusCode === 200) {
    console.log('SUCCESS: Server returned 200 OK for /admin/blank-marksheet-print.html');
  } else {
    console.error('ERROR: Server returned status', res.statusCode);
  }
}).on('error', (err) => {
  console.error('Server connection error:', err.message);
});
