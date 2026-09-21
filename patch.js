const fs = require('fs');
let html = fs.readFileSync('f:/Geography-Edu-Manage-main/Geography-Edu-Manage-main/admin/marks-entry.html', 'utf-8');
html = html.replace(
  '<h1>Subject-wise Marks Entry</h1><div class="right-actions no-print" style="margin-top:10px">',
  '<h1>Subject-wise Marks Entry</h1><div class="right-actions no-print" style="margin-top:10px"><a class="btn primary" href="individual-marks-entry.html">Individual Entry</a>'
);
fs.writeFileSync('f:/Geography-Edu-Manage-main/Geography-Edu-Manage-main/admin/marks-entry.html', html);

let html2 = fs.readFileSync('f:/Geography-Edu-Manage-main/Geography-Edu-Manage-main/admin/individual-marks-entry.html', 'utf-8');
html2 = html2.replace(
  '<h1>Subject-wise Marks Entry</h1><div class="right-actions no-print" style="margin-top:10px">',
  '<h1>Individual Student Marks Entry</h1><div class="right-actions no-print" style="margin-top:10px"><a class="btn primary" href="marks-entry.html">Subject-wise Entry</a>'
);
html2 = html2.replace(
  '<title>Marks Entry - NU Exam System</title>',
  '<title>Individual Marks Entry - NU Exam System</title>'
);
html2 = html2.replace(
  '<label class="field"><span class="label">Subject</span><select id="subjectSelect"></select></label>',
  ''
);
html2 = html2.replace(
  '<label class="field"><span class="label">Sort By</span><select id="sortField" class="input"><option value="roll">Roll</option><option value="reg">Regi No</option><option value="name">Name</option><option value="session">Session</option><option value="type">Type</option></select></label><label class="field"><span class="label">Order</span><select id="sortDir" class="input"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>',
  ''
);
html2 = html2.replace(
  '<button id="loadStudents" class="btn primary" type="button">Load Students</button>',
  '<button id="loadStudentSubjects" class="btn primary" type="button">Load Subjects</button>'
);
html2 = html2.replace(
  '<div class="marks-filter-under-load no-print">',
  '<div class="marks-filter-under-load no-print hide">'
);
html2 = html2.replace(
  '<div class="excel-file-box no-print">',
  '<div class="excel-file-box no-print hide">'
);
html2 = html2.replace(
  '<button id="syncPendingMarksBottom" class="btn green" type="button">Sync Pending Marks Now</button>',
  ''
);

fs.writeFileSync('f:/Geography-Edu-Manage-main/Geography-Edu-Manage-main/admin/individual-marks-entry.html', html2);
console.log('patched');
