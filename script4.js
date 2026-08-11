
fillSelect(document.getElementById('academicYear'), currentAcademicYears(), 'Select year');

const yearEl = document.getElementById('academicYear');
const sessionEl = document.getElementById('studySessionYear');
fillSelect(sessionEl, currentSessionYears(), 'Select session');
const sheetSearchEl = document.getElementById('sheetSearch');
const avgSortField = document.getElementById('avgSortField');
const avgSortDir = document.getElementById('avgSortDir');
let lastAverageData = null;
const individualSearchEl = document.getElementById('individualSearch');
const statusEl = document.getElementById('incStatus');
const avgHead = document.getElementById('avgHead');
const avgBody = document.getElementById('avgBody');
const individualBox = document.getElementById('individualBox');
const individualBody = document.getElementById('individualTableBody');
const individualStudentInfo = document.getElementById('individualStudentInfo');

function esc(v){return String(v ?? '').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
function typeBadge(type){
  const t = type || 'Regular';
  const cls = t === 'Irregular' ? 'irregular' : 'regular';
  return `<span class="student-type-badge ${cls}">${t}</span>`;
}
function valueOrDash(v){
  return v === '' || v === undefined || v === null ? '—' : esc(v);
}
function nat(v){
  const t=String(v??'').trim();
  const n=Number(t.replace(/[^0-9.]/g,''));
  return Number.isFinite(n)&&t.replace(/[^0-9]/g,'')!==''?n:t.toLowerCase();
}
function filterSortAverageStudents(students){
  const q=String(sheetSearchEl.value||'').trim().toLowerCase();
  let out=(students||[]).slice();
  if(q){
    out=out.filter(st=>[st.Roll,st.RegistrationNumber,st.Name,st.StudySessionYear,st.SessionYear,st.StudentType].join(' ').toLowerCase().includes(q));
  }
  const field=(avgSortField&&avgSortField.value)||'roll';
  const dir=(avgSortDir&&avgSortDir.value)==='desc'?-1:1;
  out.sort((a,b)=>{
    const av=nat(field==='reg'?a.RegistrationNumber:a.Roll);
    const bv=nat(field==='reg'?b.RegistrationNumber:b.Roll);
    let r=(typeof av==='number'&&typeof bv==='number')?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
    return r*dir;
  });
  return out;
}
function renderAverageSheet(res){
  const subjects = Array.isArray(res.subjects) ? res.subjects : [];
  const students = filterSortAverageStudents(Array.isArray(res.students) ? res.students : []);

  let head = '<tr><th rowspan="2">SL</th><th rowspan="2">Roll</th><th rowspan="2">Regi No</th><th rowspan="2">Name</th><th rowspan="2">Type</th><th rowspan="2">Study Session</th>';
  subjects.forEach(s=>{
    head += `<th class="avg-sub-head" colspan="2">${esc(s.SubjectCode)}<br>${esc(s.SubjectName)}</th>`;
  });
  head += '</tr><tr>';
  subjects.forEach(()=>{ head += '<th>Avg</th><th class="avg-att-head">Att</th>'; });
  head += '</tr>';
  avgHead.innerHTML = head;

  if(!students.length){
    avgBody.innerHTML = `<tr><td colspan="${6 + subjects.length*2}" class="empty">No student found.</td></tr>`;
    return;
  }

  avgBody.innerHTML = students.map((st,i)=>{
    let row = `<tr>
      <td>${i+1}</td>
      <td>${esc(st.Roll)}</td>
      <td>${esc(st.RegistrationNumber)}</td>
      <td>${esc(st.Name)}</td>
      <td>${typeBadge(st.StudentType)}</td>
      <td>${esc(st.StudySessionYear || st.SessionYear)}</td>`;
    subjects.forEach(s=>{
      const code = s.SubjectCode;
      const cell = st.SubjectCells && st.SubjectCells[code] ? st.SubjectCells[code] : {};
      if(cell.assigned === false){
        row += '<td class="not-assigned">X</td><td class="not-assigned">X</td>';
      }else{
        row += `<td class="avg-cell">${valueOrDash(cell.average)}</td><td class="att-cell">${valueOrDash(cell.attendance)}</td>`;
      }
    });
    row += '</tr>';
    return row;
  }).join('');
}

function rerenderAverageFromCache(){
  if(lastAverageData) renderAverageSheet(lastAverageData);
}

async function loadAverageSheet(){
  const academicYear = yearEl.value;
  const studySessionYear = sessionEl.value.trim();
  if(!academicYear){ showStatus(statusEl,'err','Academic Year required.'); return; }

  showStatus(statusEl,'info','Loading incourse average sheet...');
  try{
    const res = await geoApiGet('getIncourseAverageSheet', {
      academicYear,
      studySessionYear
    });
    if(!res.success){ showStatus(statusEl,'err',res.message || 'Load failed'); return; }
    lastAverageData = res;
    renderAverageSheet(res);
    showStatus(statusEl,'ok',(res.students||[]).length + ' students and ' + (res.subjects||[]).length + ' subjects loaded. Search/filter now works locally.');
  }catch(err){ showStatus(statusEl,'err',err.message); }
}

function findStudentInAverage(search){
  const q=String(search||'').trim().toLowerCase();
  const digits=String(search||'').replace(/\D/g,'');
  const students=(lastAverageData&&Array.isArray(lastAverageData.students))?lastAverageData.students:[];
  return students.find(st=>String(st.Roll||'').toLowerCase()===q || String(st.RegistrationNumber||'').replace(/\D/g,'')===digits || String(st.Roll||'').toLowerCase().includes(q) || (digits&&String(st.RegistrationNumber||'').replace(/\D/g,'').includes(digits)) || String(st.Name||'').toLowerCase().includes(q));
}
function renderIndividualFromAverage(st){
  const subjects=(lastAverageData&&Array.isArray(lastAverageData.subjects))?lastAverageData.subjects:[];
  individualBox.className = 'status ok';
  individualBox.innerHTML = 'Loaded from current average sheet data.';
  individualStudentInfo.innerHTML = `
    <div><b>Name:</b> ${esc(st.Name)}</div>
    <div><b>Roll:</b> ${esc(st.Roll)}</div>
    <div><b>Registration:</b> ${esc(st.RegistrationNumber)}</div>
    <div><b>Year:</b> ${esc(yearEl.value || '')}</div>`;
  const rows=[];
  subjects.forEach(s=>{
    const code=s.SubjectCode;
    const cell=st.SubjectCells&&st.SubjectCells[code]?st.SubjectCells[code]:{};
    if(cell.assigned===false) return;
    rows.push({
      SubjectCode:code,
      SubjectName:s.SubjectName,
      FirstIncourse:cell.first,
      SecondIncourse:cell.second,
      Average:cell.average,
      AttendanceMarks:cell.attendance
    });
  });
  individualBody.innerHTML = rows.length ? rows.map((r,i)=>`<tr>
    <td>${i+1}</td>
    <td>${esc(r.SubjectCode)}</td>
    <td class="sub-name">${esc(r.SubjectName)}</td>
    <td>${valueOrDash(r.FirstIncourse)}</td>
    <td>${valueOrDash(r.SecondIncourse)}</td>
    <td><b>${valueOrDash(r.Average)}</b></td>
    <td class="att-cell">${valueOrDash(r.AttendanceMarks)}</td>
  </tr>`).join('') : '<tr><td colspan="7" class="empty">No incourse result found for this student.</td></tr>';
}
async function checkIndividual(){
  const search = individualSearchEl.value.trim();
  if(!search){ showStatus(individualBox,'err','Roll/Registration required.'); return; }
  if(!lastAverageData){ showStatus(individualBox,'err','Please load average sheet first.'); return; }
  const st=findStudentInAverage(search);
  if(!st){ showStatus(individualBox,'err','Student not found in loaded average sheet.'); return; }
  renderIndividualFromAverage(st);
}


function printIncourseAverageSheet(){
  const table = document.getElementById('averageSheetTable');
  if(!table){ window.print(); return; }
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print</title><style>
    @page{size:A4 landscape;margin:8mm}
    *{box-sizing:border-box}
    body{margin:0;color:#111;background:#fff;font-family:Arial,"Noto Sans Bengali",sans-serif;font-size:10px}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #111;padding:4px 5px;text-align:center;vertical-align:middle;line-height:1.2}
    th{font-weight:700;background:#eef6f0;color:#111}
    td:nth-child(4){text-align:left}
    .student-type-badge{border:0!important;background:transparent!important;color:#111!important;padding:0!important;font-weight:700!important}
    .not-assigned{color:#111;background:#fff;text-align:center}
    .avg-cell{font-weight:700}.att-cell{background:#fffaf0}
  </style></head><body>${table.outerHTML}</body></html>`);
  doc.close();
  frame.onload = function(){
    try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
    finally{ setTimeout(()=>{ if(frame && frame.parentNode) frame.parentNode.removeChild(frame); }, 800); }
  };
}

document.getElementById('loadSheetBtn').addEventListener('click', loadAverageSheet);
document.getElementById('individualBtn').addEventListener('click', checkIndividual);
sheetSearchEl.addEventListener('input', rerenderAverageFromCache);
sheetSearchEl.addEventListener('keydown', e=>{ if(e.key === 'Enter') rerenderAverageFromCache(); });
[avgSortField,avgSortDir].forEach(el=>{if(el)el.addEventListener('change',rerenderAverageFromCache);});
individualSearchEl.addEventListener('keydown', e=>{ if(e.key === 'Enter') checkIndividual(); });
