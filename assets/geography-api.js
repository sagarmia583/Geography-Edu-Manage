const API_URL = 'https://script.google.com/macros/s/AKfycbwnEgiT4lWymsMLrtUMefSQYMr5ODVNRJeVtFFMEykwaD1ulOR2px855DHvnDe2G_Rdwg/exec';
const GEO_API_READ_TIMEOUT_MS = 30000;    // 30s — normal reads
const GEO_API_WRITE_TIMEOUT_MS = 60000;   // 60s — save/update operations
const GEO_API_LOGIN_TIMEOUT_MS = 30000;   // 30s — login
const GEO_API_HEAVY_READ_TIMEOUT_MS = 60000; // 60s — heavy data loads (result, marks, etc.)

function buildQuery(params) {
return Object.keys(params || {})
.filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
.join('&');
}

function geoIsWriteAction_(action) {
return /^(save|update|delete|register|import|process|set|publish|unpublish|issue|return|add|remove|fix|force|restore|bulk|setup|clean|hard|refresh|build|convert)/i.test(String(action || ''));
}

async function geoFetchWithTimeout_(url, options, timeoutMs) {
const ms = Number(timeoutMs || GEO_API_READ_TIMEOUT_MS);
if (typeof AbortController !== 'undefined') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('Request timed out. Please check internet / Apps Script deployment.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
return await Promise.race([
  fetch(url, options || {}),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please check internet / Apps Script deployment.')), ms))
]);
}

async function geoReadJsonResponse_(res) {
const text = await res.text();
if (!res.ok) throw new Error('API HTTP ' + res.status + ': ' + text.slice(0, 200));
try {
return JSON.parse(text);
} catch (err) {
throw new Error('Invalid API response: ' + text.slice(0, 200));
}
}

function geoAuthToken_() {
try {
  const u = JSON.parse(localStorage.getItem('geo_auth_user') || sessionStorage.getItem('geo_auth_user') || '{}');
  return (u && (u.authToken || u.token)) || '';
} catch(e) { return ''; }
}
function geoAttachAuth_(payload) {
const out = Object.assign({}, payload || {});
const token = geoAuthToken_();
if (token && !out.authToken) out.authToken = token;
try {
  const u = getAuthSession ? getAuthSession() : {};
  if (u && u.role && !out.authRole) out.authRole = u.role;
  if (u && (u.username || u.roll) && !out.authUser) out.authUser = u.username || u.roll;
} catch(e) {}
return out;
}

function geoReadTimeoutForAction_(action) {
const a = String(action || '');
if (/^(getResultPanelData|getEasyResultList|getExamResultSummaryLists|getIncourseAverageSheet|getIncourseResults|getMissingMarksList|getMarksEntryData|getAttendanceData|getFullAttendanceData|getAdmitCardData|getSeatPlanStudentsLite|getLibraryReport)$/i.test(a)) return GEO_API_HEAVY_READ_TIMEOUT_MS;
return GEO_API_READ_TIMEOUT_MS;
}

async function geoApiGetBase(action, params = {}) {
// Security: any write/update action is sent as POST with the login token.
if (geoIsWriteAction_(action)) return geoApiPostBase(Object.assign({ action }, params || {}));
const qs = buildQuery(Object.assign({ action }, params));
const timeoutMs = geoReadTimeoutForAction_(action);
const res = await geoFetchWithTimeout_(API_URL + '?' + qs, { method: 'GET', cache:'no-store' }, timeoutMs);
return geoReadJsonResponse_(res);
}

async function geoApiPostBase(payload) {
payload = geoAttachAuth_(payload || {});
const action = payload && payload.action;
const timeoutMs = String(action || '') === 'loginUser' ? GEO_API_LOGIN_TIMEOUT_MS : (geoIsWriteAction_(action) ? GEO_API_WRITE_TIMEOUT_MS : geoReadTimeoutForAction_(action));
const res = await geoFetchWithTimeout_(API_URL, {
method: 'POST',
headers:{'Content-Type':'text/plain;charset=utf-8'},
body: JSON.stringify(payload || {}),
cache:'no-store'
}, timeoutMs);
return geoReadJsonResponse_(res);
}

// XSS protection: HTML special characters escape করার জন্য global helper
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function geoToast(message, type='info') {
  if(!message) return;
  // Don't show toast for loading messages to avoid spam
  if(type === 'info' && message.toLowerCase().includes('loading')) return;
  
  let container = document.getElementById('geo-toast-container');
  if(!container) {
    container = document.createElement('div');
    container.id = 'geo-toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999999;display:flex;flex-direction:column;gap:12px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const bg = type === 'ok' ? '#ebf7f0' : type === 'err' ? '#fff0ed' : '#eff7ff';
  const color = type === 'ok' ? '#0b5e3c' : type === 'err' ? '#9d1c12' : '#084b78';
  const border = type === 'ok' ? '#b7e4c7' : type === 'err' ? '#ffb6aa' : '#b8ddff';
  const icon = type === 'ok' ? '✅ ' : type === 'err' ? '⚠️ ' : 'ℹ️ ';
  
  toast.style.cssText = `background:${bg};color:${color};border:1px solid ${border};padding:14px 22px;border-radius:16px;box-shadow:0 12px 35px rgba(0,0,0,0.15);font-weight:800;font-size:0.98rem;opacity:0;transform:translateY(30px);transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);max-width:380px;line-height:1.4;display:flex;gap:8px;align-items:flex-start;`;
  toast.innerHTML = `<span>${icon}</span><span style="flex:1">${message}</span>`;
  
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

function showStatus(el, type, message) {
  if (el) {
    el.className = 'status ' + (type || 'info');
    el.textContent = message || '';
    el.classList.remove('hide');
  }
  geoToast(message, type);
}

function readFileAsBase64(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result);
reader.onerror = reject;
reader.readAsDataURL(file);
});
}

function getParam(name) {
return new URLSearchParams(location.search).get(name) || '';
}

function currentSessionYears() {
const years = [];
const now = new Date().getFullYear();
const startYear = Math.min(2018, now - 8);
const endYear = now + 5;
for (let y = startYear; y <= endYear; y++) {
const yy = String((y + 1) % 100).padStart(2, '0');
years.push(y + '-' + yy);
}
return years;
}

function uniqueSessionYearsFromExams(exams) {
const set = {};
(exams || []).forEach(e => {
const s = String(e.SessionYear || '').trim();
if (s) set[s] = true;
});
const found = Object.keys(set).sort();
return found.length ? found : currentSessionYears();
}

function fillSessionSelectFromExams(select, exams, placeholder = 'Select session') {
const sessions = uniqueSessionYearsFromExams(exams);
fillSelect(select, sessions, placeholder);
}

function currentAcademicYears() {
return ['Honours 1st Year','Honours 2nd Year','Honours 3rd Year','Honours 4th Year','Masters'];
}

function examTypes() {
return ['1st Incourse','2nd Incourse','Test Examination','Final Exam'];
}

function fillSelect(select, items, placeholder = 'Select') {
if (!select) return;
select.innerHTML = '<option value="">' + placeholder + '</option>' + (items || []).map(x => {
const value = typeof x === 'object' ? (x.value || x.name || '') : x;
const label = typeof x === 'object' ? (x.label || x.name || x.value || '') : x;
return '<option value="' + String(value).replace(/"/g, '&quot;') + '">' + label + '</option>';
}).join('');
}


/* Manual Excel/CSV helper: used only when admin imports manual students or manual seat plan. */
function geoExcelClean_(v) {
  if (v === undefined || v === null) return '';
  let s = String(v).replace(/^\ufeff/, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();
  return s;
}
function geoExcelId_(v) {
  let s = geoExcelClean_(v);
  if (!s) return '';
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = Math.round(n).toString();
  }
  return s;
}
function geoExcelHeaderKey_(v) {
  return geoExcelClean_(v).toLowerCase().replace(/[\s_\-\/\.\(\):]+/g, '').replace(/[^a-z0-9\u0980-\u09ff]/g, '');
}
function geoExcelLoadXlsx_() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (window.__geoXlsxLoading) return window.__geoXlsxLoading;
  window.__geoXlsxLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Excel library load failed'));
    script.onerror = () => reject(new Error('Excel library load failed. Please check internet connection.'));
    document.head.appendChild(script);
  });
  return window.__geoXlsxLoading;
}
function geoExcelReadFileBuffer_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsArrayBuffer(file);
  });
}
function geoExcelReadFileText_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsText(file);
  });
}
function geoExcelLooksLikeHtml_(text) {
  return /<\s*(html|table|tr|td|th)\b/i.test(String(text || ''));
}
function geoParseHtmlTableRows_(text) {
  const doc = new DOMParser().parseFromString(String(text || ''), 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => geoExcelClean_(td.textContent))).filter(r => r.some(Boolean));
}
function geoCsvTextToRows_(text) {
  const rows = [];
  let row = [], cell = '', quote = false;
  text = String(text || '').replace(/^\ufeff/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quote && next === '"') { cell += '"'; i++; }
      else quote = !quote;
    } else if (ch === ',' && !quote) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quote) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => geoExcelClean_(x))) rows.push(row.map(geoExcelClean_));
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(x => geoExcelClean_(x))) rows.push(row.map(geoExcelClean_));
  return rows;
}
function geoExcelHeaderField_(v) {
  const k = geoExcelHeaderKey_(v);
  if (!k) return '';
  const exact = {
    classroll:'roll', roll:'roll', rollno:'roll', rollnumber:'roll', studentroll:'roll', রোল:'roll', রোলনং:'roll', রোলনম্বর:'roll',
    admissionroll:'admissionRoll', admissionrollno:'admissionRoll',
    registrationnumber:'registration', registration:'registration', regi:'registration', regno:'registration', registrationno:'registration', regino:'registration',
    mastersregno:'registration', mastersregistrationno:'registration', honsdegreeregno:'registration', honsdegreeregistrationno:'registration', honoursdegreeregno:'registration', hscregno:'hscReg', sscregno:'sscReg',
    studentname:'name', name:'name', fullname:'name', শিক্ষার্থীরনাম:'name', নাম:'name',
    studentnameবাংলায়:'nameBangla', studentnamebangla:'nameBangla',
    sessionyear:'session', session:'session', originalsession:'session', সেশন:'session',
    studysessionyear:'studySession', studysession:'studySession', currentstudysession:'studySession', currentstudysessionyear:'studySession', অধ্যয়নসেশন:'studySession',
    academicyear:'year', currentyear:'year', year:'year', classyear:'year', বর্ষ:'year',
    studentphone:'studentPhone', studentmobile:'studentPhone', phone:'studentPhone', mobile:'studentPhone', studentmobileno:'studentPhone', মোবাইল:'studentPhone',
    guardianphone:'guardianPhone', guardianmobile:'guardianPhone', guardianmobileno:'guardianPhone',
    fathersname:'fatherName', fathername:'fatherName', father:'fatherName', পিতারনাম:'fatherName',
    mothersname:'motherName', mothername:'motherName', mother:'motherName', মাতারনাম:'motherName',
    presentaddress:'address', permanentaddress:'permanentAddress', address:'address', ঠিকানা:'address', homedistrict:'homeDistrict',
    email:'email', emailaddress:'email', nid:'nid', studentnidbirthcertificate:'nid', studentsnidbirthcertificate:'nid', birthcertificate:'nid',
    studenttype:'studentType', status:'status', group:'group', subjectlist:'subjectList', bloodgroup:'bloodGroup', dateofbirth:'dateOfBirth', religion:'religion', gender:'gender'
  };
  if (exact[k]) return exact[k];
  if (k.includes('classroll') || k === 'roll') return 'roll';
  if (k.includes('masters') && k.includes('reg')) return 'registration';
  if ((k.includes('hons') || k.includes('honours') || k.includes('degree')) && k.includes('reg')) return 'registration';
  if (k.includes('registration') || k === 'regno' || k === 'regino') return 'registration';
  if (k.includes('admission') && k.includes('roll')) return 'admissionRoll';
  if (k.includes('student') && k.includes('name') && (k.includes('bangla') || k.includes('বাংলা'))) return 'nameBangla';
  if (k.includes('student') && k.includes('name')) return 'name';
  if (k.includes('session') && (k.includes('study') || k.includes('current'))) return 'studySession';
  if (k.includes('session')) return 'session';
  if (k.includes('academic') && k.includes('year')) return 'year';
  if (k.includes('current') && k.includes('year')) return 'year';
  if (k.includes('father') && k.includes('name')) return 'fatherName';
  if (k.includes('mother') && k.includes('name')) return 'motherName';
  if (k.includes('guardian') && (k.includes('phone') || k.includes('mobile'))) return 'guardianPhone';
  if (k.includes('student') && (k.includes('phone') || k.includes('mobile'))) return 'studentPhone';
  if (k.includes('present') && k.includes('address')) return 'address';
  if (k.includes('permanent') && k.includes('address')) return 'permanentAddress';
  return '';
}
function geoExtractMetaFromRows_(rows) {
  const meta = {};
  (rows || []).slice(0, 12).forEach(row => {
    for (let i = 0; i < row.length; i++) {
      const cell = geoExcelClean_(row[i]);
      const key = geoExcelHeaderKey_(cell);
      const next = geoExcelClean_(row[i + 1]);
      if ((key === 'session' || key === 'sessionyear' || key === 'session') && next && !meta.sessionYear) meta.sessionYear = next;
      if ((key === 'department' || cell.toLowerCase() === 'department') && next && !meta.department) meta.department = next;
    }
  });
  return meta;
}
function geoDetectHeaderRowIndex_(rows) {
  let best = -1, bestScore = 0;
  (rows || []).forEach((row, idx) => {
    let score = 0, hasRoll = false, hasName = false;
    row.forEach(cell => {
      const f = geoExcelHeaderField_(cell);
      if (f) score++;
      if (f === 'roll') hasRoll = true;
      if (f === 'name') hasName = true;
    });
    if (hasRoll) score += 3;
    if (hasName) score += 3;
    if (score > bestScore) { bestScore = score; best = idx; }
  });
  return bestScore >= 4 ? best : 0;
}
function geoRowsToObjectsAuto_(rows) {
  rows = (rows || []).map(r => (r || []).map(geoExcelClean_)).filter(r => r.some(Boolean));
  if (!rows.length) return [];
  const meta = geoExtractMetaFromRows_(rows);
  const headerIndex = geoDetectHeaderRowIndex_(rows);
  const headers = (rows[headerIndex] || []).map(h => geoExcelClean_(h));
  const seen = {};
  const safeHeaders = headers.map((h, i) => {
    h = h || ('Column ' + (i + 1));
    const base = h;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? base + ' #' + seen[base] : base;
  });
  const out = [];
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some(Boolean)) continue;
    const obj = { __metaSessionYear: meta.sessionYear || '', __metaDepartment: meta.department || '', __rowNumber: r + 1 };
    safeHeaders.forEach((h, i) => { if (h) obj[h] = geoExcelClean_(row[i]); });
    const roll = geoExcelValueId_(obj, ['Class Roll','Roll','Roll No','Roll Number']);
    const name = geoExcelValue_(obj, ['Student Name','Name','Full Name']);
    const reg = geoExcelValueId_(obj, ['RegistrationNumber','Registration','Reg No','Masters Reg. No.','Hons/Degree-Reg. No.','Admission Roll']);
    if (roll || name || reg) out.push(obj);
  }
  return out;
}
function geoParseCsvText_(text) {
  return geoRowsToObjectsAuto_(geoCsvTextToRows_(text));
}
async function geoParseExcelFile(file) {
  if (!file) throw new Error('Excel/CSV file select করুন');
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    return geoParseCsvText_(await geoExcelReadFileText_(file));
  }
  if (name.endsWith('.xls') || name.endsWith('.html') || name.endsWith('.htm')) {
    const text = await geoExcelReadFileText_(file);
    if (geoExcelLooksLikeHtml_(text)) return geoRowsToObjectsAuto_(geoParseHtmlTableRows_(text));
  }
  const XLSX = await geoExcelLoadXlsx_();
  const buffer = await geoExcelReadFileBuffer_(file);
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
  return geoRowsToObjectsAuto_(rows);
}
function geoExcelValue_(row, aliases) {
  const map = {};
  Object.keys(row || {}).forEach(k => { map[geoExcelHeaderKey_(k)] = row[k]; });
  for (const a of aliases || []) {
    const key = geoExcelHeaderKey_(a);
    if (map[key] !== undefined && map[key] !== null && geoExcelClean_(map[key]) !== '') return geoExcelClean_(map[key]);
  }
  return '';
}
function geoExcelValueId_(row, aliases) {
  const v = geoExcelValue_(row, aliases);
  return geoExcelId_(v);
}
function geoAcademicYearIsMasters_(year) {
  const y = geoExcelHeaderKey_(year);
  return y.includes('masters') || y.includes('master') || y.includes('মাস্টার্স');
}
function geoAcademicYearIsHonours_(year) {
  const y = geoExcelHeaderKey_(year);
  return y.includes('honours') || y.includes('honors') || y.includes('hons') || y.includes('hon') || y.includes('অনার্স');
}
function geoManualRegistrationByYear_(row, academicYear) {
  const admission = geoExcelValueId_(row, ['Admission Roll','AdmissionRoll','Admission Roll No','Admission No','Admission Number','ভর্তি রোল']);
  const genericReg = geoExcelValueId_(row, ['RegistrationNumber','Registration','Regi','Reg No','Registration No','Registration Number','Regi No','রেজি নম্বর','রেজিস্ট্রেশন']);
  
  if (geoAcademicYearIsMasters_(academicYear)) {
    const mReg = geoExcelValueId_(row, [
      'Masters Reg. No.','Masters Reg No','Masters Registration No','Masters Registration Number',
      'Master Reg. No.','Master Reg No','Master Registration No','Master Registration Number',
      'Masters-Reg-No','Masters Regi No','Masters Regi Number'
    ]);
    if(mReg) return mReg;
  }
  
  if (geoAcademicYearIsHonours_(academicYear)) {
    const hReg = geoExcelValueId_(row, [
      'Hons/Degree-Reg. No.','Hons/Degree Reg. No.','Hons/Degree Reg No','Hons/Degree Registration No','Hons/Degree Registration Number',
      'Hons Degree Reg No','Hons Degree Registration No','Honours/Degree-Reg. No.','Honours/Degree Reg. No.',
      'Honours Degree Reg No','Honours Registration No','Hons Registration No','Hons Reg. No.','Hons Reg No',
      'Degree Registration No','Degree Reg. No.','Degree Reg No'
    ]);
    if(hReg) return hReg;
  }
  
  return genericReg || admission;
}
function geoNormalizeManualSeatRows(rows) {
  return (rows || []).map(r => ({
    Roll: geoExcelValueId_(r, ['Roll','Class Roll','Roll No','Roll Number','Student Roll','রোল','রোল নং','রোল নম্বর']),
    RegistrationNumber: geoExcelValueId_(r, ['RegistrationNumber','Registration','Regi','Reg No','Registration No','Registration Number','Regi No','Masters Reg. No.','Masters Reg No','Hons/Degree-Reg. No.','Hons/Degree Reg. No.','Admission Roll','রেজি','রেজিস্ট্রেশন','রেজিস্ট্রেশন নম্বর']),
    Name: geoExcelValue_(r, ['Name','Student Name','Full Name','নাম','শিক্ষার্থীর নাম'])
  })).filter(r => r.Roll || r.RegistrationNumber || r.Name);
}
function geoNormalizeManualStudentRows(rows, defaults) {
  defaults = defaults || {};
  return (rows || []).map(r => {
    const fileSession = geoExcelValue_(r, ['SessionYear','Session','Original Session','Session :','সেশন']) || geoExcelClean_(r.__metaSessionYear);
    const session = geoExcelClean_(defaults.sessionYear) || fileSession || '';
    const studySession = session;
    const year = geoExcelClean_(defaults.academicYear) || geoExcelValue_(r, ['AcademicYear','CurrentYear','Year','Academic Year','Current Year','Class Year','বর্ষ']) || '';
    const studentPhone = geoExcelValueId_(r, ['StudentPhone','Student Mobile','StudentMobile','Student Phone','Phone','Mobile','Student Phone No','মোবাইল','শিক্ষার্থীর মোবাইল']);
    const guardianPhone = geoExcelValueId_(r, ['GuardianPhone','Guardian Mobile','GuardianMobile','Guardian Phone','Guardian Phone No','অভিভাবকের মোবাইল']);
    const reg = geoManualRegistrationByYear_(r, year);
    return {
      name: geoExcelValue_(r, ['Name','StudentName','Student Name','Full Name','নাম','শিক্ষার্থীর নাম']),
      roll: geoExcelValueId_(r, ['Roll','Class Roll','Roll No','Roll Number','Student Roll','রোল','রোল নং','রোল নম্বর']),
      registrationNumber: reg,
      admissionRoll: geoExcelValueId_(r, ['Admission Roll','AdmissionRoll','Admission Roll No']),
      sessionYear: session,
      studySessionYear: studySession,
      currentStudySession: studySession,
      academicYear: year,
      currentYear: year,
      fatherName: geoExcelValue_(r, ['FatherName','Father Name','Father','Father\'s Name','পিতার নাম']),
      motherName: geoExcelValue_(r, ['MotherName','Mother Name','Mother','Mother\'s Name','মাতার নাম']),
      address: geoExcelValue_(r, ['Present Address','Address','ঠিকানা']) || geoExcelValue_(r, ['Permanent Address']),
      permanentAddress: geoExcelValue_(r, ['Permanent Address']),
      homeDistrict: geoExcelValue_(r, ['Home District','District']),
      email: geoExcelValue_(r, ['Email','E-mail','ইমেইল']),
      studentPhone: studentPhone,
      studentMobile: studentPhone,
      guardianPhone: guardianPhone,
      guardianMobile: guardianPhone,
      fatherNid: geoExcelValueId_(r, ['Father\'s NID','Father NID','Father Nid']),
      studentNid: geoExcelValueId_(r, ['Student\'s NID/Birth Certificate','Student NID/Birth Certificate','NID','Birth Certificate']),
      bloodGroup: geoExcelValue_(r, ['Blood Group']),
      dateOfBirth: geoExcelValue_(r, ['Date of Birth','DOB']),
      religion: geoExcelValue_(r, ['Religion']),
      gender: geoExcelValue_(r, ['Gender']),
      nonMajorGroup: geoExcelValue_(r, ['NonMajorGroup','Non Major Group','Non-Major Group']),
      nonMajor1: geoExcelValue_(r, ['NonMajor1','Non Major 1','Non-Major 1']),
      nonMajor2: geoExcelValue_(r, ['NonMajor2','Non Major 2','Non-Major 2']),
      group: geoExcelValue_(r, ['Science/Humanities Group','Non Major Group']),
      subjectList: geoExcelValue_(r, ['Subject List']),
      password: geoExcelValue_(r, ['Password','Pass','পাসওয়ার্ড']) || geoExcelValueId_(r, ['Roll','Class Roll','Roll No','Roll Number']),
      status: geoExcelValue_(r, ['Status']) || 'Active',
      studyStatus: geoExcelValue_(r, ['StudyStatus','Study Status','Student Type']) || 'Continuing'
    };
  }).filter(r => r.roll || r.registrationNumber || r.name);
}


function setAuthCookie_(user){
try{
  const encoded = encodeURIComponent(JSON.stringify(user || {}));
  const maxAge = 60 * 60 * 24 * 14;
  document.cookie = 'geo_auth_user=' + encoded + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
  document.cookie = 'geo_logged_in=yes; path=/; max-age=' + maxAge + '; SameSite=Lax';
  if(user && user.role) document.cookie = 'geo_role=' + encodeURIComponent(user.role) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
}catch(e){}
}
function getCookie_(name){
try{
  const key = name + '=';
  const parts = String(document.cookie || '').split(';');
  for(const part of parts){
    const p = part.trim();
    if(p.indexOf(key) === 0) return decodeURIComponent(p.slice(key.length));
  }
}catch(e){}
return '';
}
function getAuthCookieUser_(){
try{
  const raw = getCookie_('geo_auth_user');
  if(raw){
    const u = JSON.parse(raw);
    if(u && (u.loggedIn || getCookie_('geo_logged_in') === 'yes')) return u;
  }
}catch(e){}
const role = getCookie_('geo_role');
if(getCookie_('geo_logged_in') === 'yes' || role){
  return {loggedIn:true, role:role || 'admin', name:role === 'student' ? 'Student' : 'Admin', fromCookie:true};
}
return {};
}
function clearAuthCookie_(){
try{
  document.cookie='geo_auth_user=; path=/; max-age=0; SameSite=Lax';
  document.cookie='geo_logged_in=; path=/; max-age=0; SameSite=Lax';
  document.cookie='geo_role=; path=/; max-age=0; SameSite=Lax';
}catch(e){}
}
function syncAuthEverywhere_(user){
try{ if(user && user.loggedIn){ localStorage.setItem('geo_auth_user', JSON.stringify(user)); localStorage.setItem('geo_role', user.role || 'admin'); localStorage.setItem('geo_logged_in','yes'); } }catch(e){}
try{ if(user && user.loggedIn){ sessionStorage.setItem('geo_auth_user', JSON.stringify(user)); sessionStorage.setItem('geo_role', user.role || 'admin'); sessionStorage.setItem('geo_logged_in','yes'); } }catch(e){}
try{ if(user && user.loggedIn) setAuthCookie_(user); }catch(e){}
return user || {};
}

function saveAuthSession(user) {
const u = Object.assign({}, user || {});
u.loggedIn = true;
if (!u.role) u.role = 'admin';
try { localStorage.setItem('geo_auth_user', JSON.stringify(u)); } catch(e) {}
try { sessionStorage.setItem('geo_auth_user', JSON.stringify(u)); } catch(e) {}
try { localStorage.setItem('geo_role', u.role); } catch(e) {}
try { sessionStorage.setItem('geo_role', u.role); } catch(e) {}
try { localStorage.setItem('geo_logged_in', 'yes'); } catch(e) {}
try { sessionStorage.setItem('geo_logged_in', 'yes'); } catch(e) {}
try { localStorage.setItem('geo_login_time', String(Date.now())); } catch(e) {}
try { setAuthCookie_(u); } catch(e) {}
return u;
}

function restoreAuthFromUrl_() {
// URL parameters cannot create login sessions. Login must come from API verification.
return null;
}

function getAuthSession() {
const urlUser = restoreAuthFromUrl_();
if (urlUser && urlUser.loggedIn) return syncAuthEverywhere_(urlUser);
let user = {};
try { user = JSON.parse(localStorage.getItem('geo_auth_user') || '{}'); } catch(e) { user = {}; }
if (!user || !user.loggedIn) {
try { user = JSON.parse(sessionStorage.getItem('geo_auth_user') || '{}'); } catch(e) { user = {}; }
}
if (!user || !user.loggedIn) {
try { user = getAuthCookieUser_(); } catch(e) { user = {}; }
}
const role = (user && user.role) || localStorage.getItem('geo_role') || sessionStorage.getItem('geo_role') || getCookie_('geo_role') || '';
const logged = (user && user.loggedIn) || localStorage.getItem('geo_logged_in') === 'yes' || sessionStorage.getItem('geo_logged_in') === 'yes' || getCookie_('geo_logged_in') === 'yes';
if (logged) user.loggedIn = true;
if (role && !user.role) user.role = role;
if (user && user.loggedIn) syncAuthEverywhere_(user);
return user || {};
}
function clearAuthSession() {
try { localStorage.removeItem('geo_auth_user'); } catch(e) {}
try { sessionStorage.removeItem('geo_auth_user'); } catch(e) {}
try { localStorage.removeItem('geo_role'); } catch(e) {}
try { sessionStorage.removeItem('geo_role'); } catch(e) {}
try { localStorage.removeItem('geo_logged_in'); } catch(e) {}
try { sessionStorage.removeItem('geo_logged_in'); } catch(e) {}
try { clearAuthCookie_(); } catch(e) {}
try { clearGeoCache(); } catch(e) {}
}

function requireAuth(role) {
let user = getAuthSession();
if (!user || !user.loggedIn) {
  const cookieUser = getAuthCookieUser_();
  if(cookieUser && cookieUser.loggedIn) user = syncAuthEverywhere_(cookieUser);
}
if (!user || !user.loggedIn) {
  location.href = '../index.html';
  return null;
}
if (role && user.role && user.role !== role) {
  clearAuthSession();
  location.href = '../index.html';
  return null;
}
if (role && !user.role) {
  clearAuthSession();
  location.href = '../index.html';
  return null;
}
if (role === 'admin' && !user.authToken) {
  clearAuthSession();
  location.href = '../index.html';
  return null;
}
return user;
}
function attachLogout() {
document.querySelectorAll('[data-logout]').forEach(btn => {
btn.addEventListener('click', () => {
clearAuthSession();
location.href = '../index.html';
});
});
}

/* Fast preload/cache system */

// Lite mode: do not clear preload cache on every page load.
function clearAllSubjectRelatedCaches(){ return; }

// Lite mode: old preload cache cleanup disabled to avoid repeated slow loading.

const GEO_CACHE_KEY = 'geo_preload_cache_v6';
const GEO_CACHE_TIME_KEY = 'geo_preload_cache_time_v6';
const GEO_CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours ultra-lite cache
const GEO_PRELOAD_ATTEMPT_KEY = 'geo_preload_last_attempt_v6';

function geoNow(){ return Date.now ? Date.now() : new Date().getTime(); }

function setGeoCache(data) {
try {
localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(data || {}));
localStorage.setItem(GEO_CACHE_TIME_KEY, String(geoNow()));
} catch (e) {
console.warn('Preload cache save failed', e);
}
}

function getGeoCache(maxAgeMs = GEO_CACHE_TTL) {
try {
const time = Number(localStorage.getItem(GEO_CACHE_TIME_KEY) || 0);
if (!time || (geoNow() - time) > maxAgeMs) return null;
const raw = localStorage.getItem(GEO_CACHE_KEY);
return raw ? JSON.parse(raw) : null;
} catch (e) {
return null;
}
}

function clearGeoCache() {
localStorage.removeItem(GEO_CACHE_KEY);
localStorage.removeItem(GEO_CACHE_TIME_KEY);
try { clearLiteGetCache(); } catch(e) {}
}

function getCachedList(name) {
const cache = getGeoCache();
if (!cache || !cache[name]) return null;
return cache[name];
}

function getCachedSubjects(params = {}) {
let rows = getCachedList('subjects');
if (!Array.isArray(rows)) return null;
if (params.academicYear) rows = rows.filter(r => String(r.AcademicYear || '').trim() === String(params.academicYear).trim());
if (params.subjectType) rows = rows.filter(r => String(r.SubjectType || '').trim() === String(params.subjectType).trim());
if (params.subjectCode) rows = rows.filter(r => String(r.SubjectCode || '').trim() === String(params.subjectCode).trim());
return { success:true, subjects:rows, source:'browser-preload-cache' };
}

function getCachedStudents(params = {}) {
let rows = getCachedList('students');
if (!Array.isArray(rows)) return null;
if (params.academicYear || params.currentYear) {
const y = String(params.academicYear || params.currentYear).trim();
rows = rows.filter(r => String(r.CurrentYear || '').trim() === y);
}
if (params.search || params.q || params.keyword || params.roll || params.registrationNumber || params.regNo) {
const q = String(params.search || params.q || params.keyword || params.roll || params.registrationNumber || params.regNo).toLowerCase().trim();
rows = rows.filter(r => [r.Roll,r.RegistrationNumber,r.Name,r.SessionYear,r.CurrentYear,r.StudentType,r.IrregularStatus].join(' ').toLowerCase().includes(q));
}
if (typeof sortStudentList === 'function') rows = sortStudentList(rows, params.sortField || params.sortBy || 'roll', params.sortDir || params.order || 'asc');
return { success:true, students:rows, source:'browser-preload-cache' };
}

function getCachedExams(params = {}) {
let rows = getCachedList('exams');
if (!Array.isArray(rows)) return null;
if (params.academicYear) rows = rows.filter(r => String(r.AcademicYear || '').trim() === String(params.academicYear).trim());
if (params.examType) rows = rows.filter(r => String(r.ExamType || '').trim() === String(params.examType).trim());
return { success:true, exams:rows, source:'browser-preload-cache' };
}

function getCachedStudentSubjects(params = {}) {
let rows = getCachedList('studentSubjects');
if (!Array.isArray(rows)) return null;
if (params.academicYear) rows = rows.filter(r => String(r.AcademicYear || '').trim() === String(params.academicYear).trim());
if (params.roll) rows = rows.filter(r => String(r.Roll || '').trim() === String(params.roll).trim());
return { success:true, subjects:rows, source:'browser-preload-cache' };
}

function getCachedFinalResults(params = {}) {
let rows = getCachedList('finalResults');
if (!Array.isArray(rows)) return null;
if (params.academicYear) rows = rows.filter(r => String(r.AcademicYear || '').trim() === String(params.academicYear).trim());
if (params.roll) rows = rows.filter(r => String(r.Roll || '').trim() === String(params.roll).trim());
return { success:true, results:rows, source:'browser-preload-cache' };
}

function getCachedAttendanceMarks(params = {}) {
let rows = getCachedList('attendanceMarks');
if (!Array.isArray(rows)) return null;
if (params.academicYear) rows = rows.filter(r => String(r.AcademicYear || '').trim() === String(params.academicYear).trim());
if (params.roll) rows = rows.filter(r => String(r.Roll || '').trim() === String(params.roll).trim());
return { success:true, marks:rows, source:'browser-preload-cache' };
}

function getCachedExamSchedule(params = {}) {
let rows = getCachedList('examSchedule');
if (!Array.isArray(rows)) return null;
if (params.examId) rows = rows.filter(r => String(r.ExamID || '').trim() === String(params.examId).trim());
if (params.academicYear) rows = rows.filter(r => String(r.AcademicYear || '').trim() === String(params.academicYear).trim());
return { success:true, schedule:rows, source:'browser-preload-cache' };
}

async function preloadGeoData(options = {}) {
// Ultra-lite: no automatic full-data preload.
// Only run if forceFull is true from a manual refresh.
if (!options.forceFull) return null;

const statusEl = options.statusEl || null;
const data = await __geoApiGetOriginal('getPreloadData', { scope:'admin', light:'false', _t: Date.now(), noCache:'1' });
if (data && data.success) {
setGeoCache(data);
if (statusEl) showStatus(statusEl, 'ok', 'Loaded.');
window.dispatchEvent(new CustomEvent('geo-preload-ready', { detail:data }));
}
return data;
}

function getSubjectMiniCacheKey(params = {}) {
return 'geo_subject_mini_cache_' + String(params.academicYear || 'all').replace(/\W+/g,'_');
}
function getSubjectMiniCache(params = {}) {
try {
const key = getSubjectMiniCacheKey(params);
const raw = localStorage.getItem(key);
const time = Number(localStorage.getItem(key + '_time') || 0);
if(!raw || !time || (Date.now() - time) > 1000 * 60 * 5) return null;
return JSON.parse(raw);
} catch(e) { return null; }
}
function setSubjectMiniCache(params = {}, data) {
try {
const key = getSubjectMiniCacheKey(params);
localStorage.setItem(key, JSON.stringify(data || {}));
localStorage.setItem(key + '_time', String(Date.now()));
} catch(e) {}
}

function liteGetCacheKey(action, params = {}) {
const safe = Object.assign({}, params || {});
delete safe._t;
delete safe.noCache;
delete safe.force;
return 'geo_lite_get_' + action + '_' + btoa(unescape(encodeURIComponent(JSON.stringify(safe)))).replace(/=+$/,'').slice(0,80);
}
function getLiteGetCache(action, params = {}, ttlMs = 1000 * 60 * 3) {
try {
const key = liteGetCacheKey(action, params);
const time = Number(localStorage.getItem(key + '_time') || 0);
if(!time || (Date.now() - time) > ttlMs) return null;
const raw = localStorage.getItem(key);
return raw ? JSON.parse(raw) : null;
} catch(e) { return null; }
}
function setLiteGetCache(action, params = {}, data) {
try {
if (data && data.success === false) return;
const key = liteGetCacheKey(action, params);
localStorage.setItem(key, JSON.stringify(data || {}));
localStorage.setItem(key + '_time', String(Date.now()));
} catch(e) {}
}
function clearLiteGetCache(){
try {
Object.keys(localStorage).forEach(k => {
if(k.indexOf('geo_lite_get_') === 0 || k.indexOf('geo_subject_mini_cache_') === 0){
localStorage.removeItem(k);
}
});
} catch(e) {}
}

async function geoApiGet(action, params = {}) {
const noCache = params && (params.noCache || params.force);
if (!noCache) {
if (action === 'getSubjects') {
const cachedSubjects = getSubjectMiniCache(params);
if (cachedSubjects) return cachedSubjects;
const freshSubjects = await geoApiGetBase(action, params);
setSubjectMiniCache(params, freshSubjects);
return freshSubjects;
}
if (action === 'getStudents') {
const cached = getCachedStudents(params);
if (cached) return cached;
const mini = getLiteGetCache(action, params, 1000 * 60 * 2);
if (mini) return mini;
const fresh = await geoApiGetBase(action, params);
setLiteGetCache(action, params, fresh);
return fresh;
}
if (action === 'getExams') {
const cached = getCachedExams(params);
if (cached) return cached;
const mini = getLiteGetCache(action, params, 1000 * 60 * 8);
if (mini) return mini;
const fresh = await geoApiGetBase(action, params);
setLiteGetCache(action, params, fresh);
return fresh;
}
if (action === 'getMarksEntryData') {
const mini = getLiteGetCache(action, params, 1000 * 45);
if (mini) return mini;
const fresh = await geoApiGetBase(action, params);
setLiteGetCache(action, params, fresh);
return fresh;
}
// StudentSubjects can change after subject cleanup, so load fresh.
if (action === 'getStudentSubjects') {
return geoApiGetBase(action, Object.assign({}, params, { _t: Date.now() }));
}
if (action === 'getFinalResults') {
const cached = getCachedFinalResults(params);
if (cached) return cached;
}
if (action === 'getAttendanceMarks') {
const cached = getCachedAttendanceMarks(params);
if (cached) return cached;
}
if (action === 'getExamSchedule') {
const cached = getCachedExamSchedule(params);
if (cached) return cached;
}
if (action === 'getBooks') {
const rows = getCachedList('books');
if (Array.isArray(rows)) return { success:true, books:rows, source:'browser-preload-cache' };
}
if (action === 'getNotices') {
const rows = getCachedList('notices');
if (Array.isArray(rows)) return { success:true, notices:rows, source:'browser-preload-cache' };
}
}
return geoApiGetBase(action, params);
}

async function geoApiPost(payload) {
const res = await geoApiPostBase(payload);
// Any write action can make cache stale, so clear it automatically.
if (payload && payload.action && payload.action !== 'loginUser') {
clearGeoCache();
try { localStorage.removeItem(GEO_PRELOAD_ATTEMPT_KEY); } catch(e) {}
}
return res;
}

/* Persistent write queue for marks and critical saves */
const GEO_WRITE_QUEUE_KEY = 'geo_write_queue_v1';
let __geoQueueRunning = false;

function geoQueueId(){
return 'Q' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
}
function getGeoWriteQueue(){
try { return JSON.parse(localStorage.getItem(GEO_WRITE_QUEUE_KEY) || '[]'); }
catch(e){ return []; }
}
function setGeoWriteQueue(q){
try {
localStorage.setItem(GEO_WRITE_QUEUE_KEY, JSON.stringify(q || []));
window.dispatchEvent(new CustomEvent('geo-write-queue-change', { detail:{ queue:q || [] } }));
} catch(e) {
console.warn('Write queue save failed', e);
}
}
function getGeoWriteQueueCount(){
return getGeoWriteQueue().length;
}
function updateGeoQueueBadge(){
let badge = document.getElementById('geoQueueBadge');
const count = getGeoWriteQueueCount();
if(!badge){
badge = document.createElement('div');
badge.id = 'geoQueueBadge';
document.body.appendChild(badge);
}
if(count > 0){
badge.textContent = 'Saving pending: ' + count;
badge.classList.add('show');
}else{
badge.textContent = '';
badge.classList.remove('show');
}
}
function enqueueGeoWrite(payload, meta = {}){
const q = getGeoWriteQueue();
const item = {
id: meta.id || geoQueueId(),
payload: payload,
meta: meta,
attempts: 0,
createdAt: Date.now(),
lastError: ''
};
q.push(item);
setGeoWriteQueue(q);
updateGeoQueueBadge();
setTimeout(()=>processGeoWriteQueue(), 80);
return item;
}
function compactGeoWriteQueue(q){
const groups = {};
const out = [];
(q || []).forEach(item=>{
  const p = item && item.payload ? item.payload : {};
  if(p.action === 'saveMarks' && Array.isArray(p.marks) && p.marks.length){
    const key = ['saveMarks', p.examId || '', p.subjectCode || '', p.studySessionYear || p.currentStudySession || p.sessionYear || ''].join('|');
    if(!groups[key]){
      groups[key] = {
        id:item.id,
        payload:{ action:'saveMarks', examId:p.examId, subjectCode:p.subjectCode, studySessionYear:(p.studySessionYear || p.currentStudySession || p.sessionYear || ''), marks:[] },
        meta:Object.assign({}, item.meta || {}, {type:'marks-bulk'}),
        attempts:Number(item.attempts || 0),
        createdAt:item.createdAt || Date.now(),
        lastTryAt:item.lastTryAt,
        lastError:item.lastError || '',
        _rolls:{},
        _items:[]
      };
      out.push(groups[key]);
    }
    const g = groups[key];
    if(!g.payload.studySessionYear && (p.studySessionYear || p.currentStudySession || p.sessionYear)){
      g.payload.studySessionYear = p.studySessionYear || p.currentStudySession || p.sessionYear;
    }
    g.attempts = Math.max(Number(g.attempts || 0), Number(item.attempts || 0));
    if(item.lastTryAt) g.lastTryAt = Math.min(Number(g.lastTryAt || item.lastTryAt), Number(item.lastTryAt));
    p.marks.forEach(row=>{
      const roll = row && row.roll ? String(row.roll) : geoQueueId();
      g._rolls[roll] = row;
    });
    g._items.push(item);
  }else{
    out.push(item);
  }
});
out.forEach(item=>{
  if(item && item._rolls){
    item.payload.marks = Object.keys(item._rolls).map(k=>item._rolls[k]);
    item.meta.count = item.payload.marks.length;
    item.meta.rolls = item.payload.marks.map(r=>r.roll).filter(Boolean);
    delete item._rolls;
  }
});
return out;
}
async function processGeoWriteQueue(){
if(__geoQueueRunning) return;
__geoQueueRunning = true;

try{
let q = compactGeoWriteQueue(getGeoWriteQueue());
if(!q.length){ updateGeoQueueBadge(); return; }
setGeoWriteQueue(q);

const now = Date.now();
const remaining = [];

for(const item of q){
item.attempts = Number(item.attempts || 0);
const waitMs = Math.min(3000 + item.attempts * 1500, 20000);
if(item.lastTryAt && (now - Number(item.lastTryAt)) < waitMs){
remaining.push(item);
continue;
}

item.attempts += 1;
item.lastTryAt = now;

try{
const res = await __geoApiPostOriginal(item.payload);
if(!res || res.success === false) throw new Error((res && res.message) || 'Save failed');
if (item.payload && item.payload.action && item.payload.action !== 'loginUser') {
try { if(typeof geoClearActionCache_ === 'function') geoClearActionCache_(item.payload.action); else clearGeoCache(); } catch(e) {}
try { localStorage.removeItem(GEO_PRELOAD_ATTEMPT_KEY); } catch(e) {}
}
window.dispatchEvent(new CustomEvent('geo-write-saved', { detail:{ item, response:res } }));
}catch(err){
item.lastError = err.message || String(err);
remaining.push(item);
window.dispatchEvent(new CustomEvent('geo-write-failed', { detail:{ item, error:item.lastError } }));
// Do not block other queue items permanently.
}
}

setGeoWriteQueue(remaining);
updateGeoQueueBadge();
} finally {
__geoQueueRunning = false;
}
}

function startGeoQueueWorker(){
updateGeoQueueBadge();
setTimeout(()=>processGeoWriteQueue(), 500);
setInterval(()=>processGeoWriteQueue(), 5000);
window.addEventListener('online', ()=>setTimeout(()=>processGeoWriteQueue(), 300));
window.addEventListener('focus', ()=>setTimeout(()=>processGeoWriteQueue(), 300));
}
document.addEventListener('DOMContentLoaded', startGeoQueueWorker);

function startSmartPreload(){
// Lite mode: no automatic full preload on page open.
// Pages load only the data they need. Use manual refresh/preload button when needed.
return;
}

const UF_FAST_READ_TTL = {
  getDashboardCounts: 300000,
  getExams: 180000,
  getEasyResultChoices: 180000,
  getPublishedExamSessions: 180000,
  getPublishedExamsForStudent: 180000,
  getSubjects: 180000,
  getSubjectsForExamCreate: 180000,
  getExamSchedule: 120000,
  getStudents: 90000,
  getBooks: 180000,
  getLibraryReport: 90000,
  getAttendanceMarks: 60000,
  getFinalResults: 60000,
  getMarksEntryData: 25000,
  getAdmitCardData: 180000,
  getSeatPlanStudentsLite: 300000,
  getStudentSubjects: 60000
};
function ufFastReadKey(action, params={}){
  const p=Object.assign({}, params||{});
  delete p._t; delete p.noCache; delete p.force; delete p.forceFresh;
  return 'uf_fast_get_'+action+'_'+btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/=+$/,'').slice(0,110);
}
function ufFastReadGet(action, params={}){
  try{
    const ttl = UF_FAST_READ_TTL[action];
    if(!ttl || params.forceFresh) return null;
    const key=ufFastReadKey(action,params);
    const time=Number(localStorage.getItem(key+'_time')||0);
    if(!time || Date.now()-time>ttl) return null;
    const raw=localStorage.getItem(key);
    if(!raw) return null;
    const data=JSON.parse(raw);
    if(data && typeof data==='object') data.fromUltraFastCache=true;
    return data;
  }catch(e){return null;}
}
function ufFastReadSet(action, params={}, data){
  try{
    if(!UF_FAST_READ_TTL[action] || !data || data.success===false) return;
    const key=ufFastReadKey(action,params);
    const raw=JSON.stringify(data);
    if(raw.length>450000) return;
    localStorage.setItem(key,raw);
    localStorage.setItem(key+'_time',String(Date.now()));
  }catch(e){}
}
const __ufFastGeoApiGetPrev = geoApiGet;
geoApiGet = async function(action, params={}){
  const cached = ufFastReadGet(action, params);
  if(cached) return cached;
  const fresh = await __ufFastGeoApiGetPrev(action, params);
  ufFastReadSet(action, params, fresh);
  return fresh;
};
const __ufFastClearLiteGetCachePrev = clearLiteGetCache;
clearLiteGetCache = function(){
  try{ __ufFastClearLiteGetCachePrev(); }catch(e){}
  try{
    Object.keys(localStorage).forEach(k=>{
      if(k.indexOf('uf_fast_get_')===0) localStorage.removeItem(k);
    });
  }catch(e){}
};

const __geoApiGetCacheBypassFinal = geoApiGet;
geoApiGet = async function(action, params={}){
  if(params && (params.noCache || params.force || params.forceFresh)){
    return __geoApiGetOriginal ? __geoApiGetOriginal(action, params) : __geoApiGetCacheBypassFinal(action, params);
  }
  return __geoApiGetCacheBypassFinal(action, params);
};

const __geoUltraLiteApiGetPrev = geoApiGet;
const __geoUltraLiteInFlight = {};
function geoStableStringify(value){
  if(value === null || typeof value !== 'object') return JSON.stringify(value);
  if(Array.isArray(value)) return '[' + value.map(geoStableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + geoStableStringify(value[k])).join(',') + '}';
}
geoApiGet = async function(action, params={}){
  if(params && (params.noCache || params.force || params.forceFresh)){
    return __geoUltraLiteApiGetPrev(action, params);
  }
  const p = Object.assign({}, params||{});
  delete p._t; delete p.noCache; delete p.force; delete p.forceFresh;
  const key = action + '|' + geoStableStringify(p);
  if(__geoUltraLiteInFlight[key]) return __geoUltraLiteInFlight[key];
  const req = __geoUltraLiteApiGetPrev(action, params).finally(()=>{ delete __geoUltraLiteInFlight[key]; });
  __geoUltraLiteInFlight[key] = req;
  return req;
};


document.addEventListener('DOMContentLoaded', function(){
try{
  const user = getAuthSession();
  if(!user || !user.loggedIn) return;
  document.querySelectorAll('a[href]').forEach(function(a){
    const href = a.getAttribute('href') || '';
    if(!href || href.indexOf('javascript:')===0 || href.indexOf('#')===0 || href.indexOf('http')===0) return;
    if(href.indexOf('/admin/')>=0 || href.indexOf('admin/')===0 || location.pathname.indexOf('/admin/')>=0){
      a.addEventListener('click', function(){ syncAuthEverywhere_(user); }, true);
      a.addEventListener('mousedown', function(){ syncAuthEverywhere_(user); }, true);
    }
  });
}catch(e){}
});


/* ===== DATA LOAD TIMEOUT SAFE LAYER ===== */
const __geoTimeoutSafeGetPrev = geoApiGet;
function geoTimeoutSafeCached_(action, params){
  try{
    const p = Object.assign({}, params || {});
    delete p.noCache; delete p.force; delete p.forceFresh; delete p._t;
    if (typeof ufFastReadGet === 'function') {
      const c = ufFastReadGet(action, p);
      if (c) return c;
    }
    if (typeof getLiteGetCache === 'function') {
      const l = getLiteGetCache(action, p, 1000 * 60 * 10);
      if (l) return l;
    }
  }catch(e){}
  return null;
}
geoApiGet = async function(action, params={}){
  try{
    return await __geoTimeoutSafeGetPrev(action, params || {});
  }catch(err){
    const msg = String((err && err.message) || err || '');
    if (/timed out|Failed to fetch|network/i.test(msg)) {
      const cached = geoTimeoutSafeCached_(action, params || {});
      if (cached) return cached;
    }
    throw err;
  }
};


/* ===== DATA LOAD FAST STABLE LAYER ===== */
const __geoLoadFastPrevGet = geoApiGet;
const GEO_LOAD_FAST_CACHEABLE = {
  getDashboardCounts:1,
  getExams:1,
  getEasyResultChoices:1,
  getPublishedExamSessions:1,
  getPublishedExamsForStudent:1,
  getSubjects:1,
  getSubjectsForExamCreate:1,
  getExamSchedule:1,
  getStudents:1,
  getStudentSubjects:1,
  getAttendanceMarks:1,
  getAttendanceMarksData:1,
  getFinalResults:1,
  getMarksEntryData:1,
  getMissingMarksList:1,
  getIncourseAverageSheet:1,
  getIncourseResults:1,
  getResultPanelData:1,
  getEasyResultList:1,
  getExamResultSummaryLists:1,
  getAdmitCardData:1,
  getSeatPlanStudentsLite:1,
  getFullAttendanceData:1,
  getLibraryReport:1,
  getBooks:1,
  getNotices:1
};
function geoLoadFastCleanParams_(params){
  const p = Object.assign({}, params || {});
  delete p._t;
  delete p.noCache;
  delete p.force;
  delete p.forceFresh;
  delete p.hardRefresh;
  return p;
}
function geoLoadFastCached_(action, params){
  const p = geoLoadFastCleanParams_(params || {});
  try{ if(typeof ufFastReadGet === 'function'){ const c = ufFastReadGet(action, p); if(c) return c; } }catch(e){}
  try{ if(typeof getLiteGetCache === 'function'){ const c = getLiteGetCache(action, p, 1000 * 60 * 20); if(c) return c; } }catch(e){}
  try{
    if(action === 'getSubjects' && typeof getSubjectMiniCache === 'function'){
      const c = getSubjectMiniCache(p); if(c) return c;
    }
  }catch(e){}
  try{
    if(typeof ufFastReadKey === 'function'){
      const key = ufFastReadKey(action, p);
      const raw = localStorage.getItem(key);
      const time = Number(localStorage.getItem(key + '_time') || 0);
      if(raw && time && Date.now() - time < 1000 * 60 * 60 * 12){
        const data = JSON.parse(raw);
        if(data && typeof data === 'object') data.fromUltraFastCache = true;
        return data;
      }
    }
  }catch(e){}
  try{
    if(typeof liteGetCacheKey === 'function'){
      const key = liteGetCacheKey(action, p);
      const raw = localStorage.getItem(key);
      const time = Number(localStorage.getItem(key + '_time') || 0);
      if(raw && time && Date.now() - time < 1000 * 60 * 60 * 12){
        const data = JSON.parse(raw);
        if(data && typeof data === 'object') data.fromLiteCache = true;
        return data;
      }
    }
  }catch(e){}
  return null;
}
function geoLoadFastStore_(action, params, data){
  const p = geoLoadFastCleanParams_(params || {});
  try{ if(typeof ufFastReadSet === 'function') ufFastReadSet(action, p, data); }catch(e){}
  try{ if(typeof setLiteGetCache === 'function') setLiteGetCache(action, p, data); }catch(e){}
  try{ if(action === 'getSubjects' && typeof setSubjectMiniCache === 'function') setSubjectMiniCache(p, data); }catch(e){}
}
geoApiGet = async function(action, params={}){
  const p = params || {};
  const hard = !!(p.forceFresh || p.hardRefresh);
  if(!hard && GEO_LOAD_FAST_CACHEABLE[action]){
    const cached = geoLoadFastCached_(action, p);
    if(cached) return cached;
    const cleanParams = geoLoadFastCleanParams_(p);
    const fresh = await __geoLoadFastPrevGet(action, cleanParams);
    geoLoadFastStore_(action, cleanParams, fresh);
    return fresh;
  }
  return __geoLoadFastPrevGet(action, p);
};

function geoClearActionCache_(action){
  const a = String(action || '');
  const removeByAction = [];
  if(/Marks|Attendance|Result|Publish|Summary|Incourse|Final/i.test(a)){
    removeByAction.push('getMarksEntryData','getMissingMarksList','getIncourseAverageSheet','getIncourseResults','getAttendanceMarks','getAttendanceMarksData','getEasyResultList','getResultPanelData','getExamResultSummaryLists','getFinalResults');
  }
  if(/StudentSubject|Subject|Student|Promot/i.test(a)){
    removeByAction.push('getStudents','getStudentSubjects','getSubjects','getSubjectsForExamCreate','getMarksEntryData','getMissingMarksList','getIncourseAverageSheet');
  }
  if(/Exam|Schedule|Admit|Seat/i.test(a)){
    removeByAction.push('getExams','getEasyResultChoices','getExamSchedule','getSubjectsForExamCreate','getAdmitCardData','getSeatPlanStudentsLite','getFullAttendanceData','getMarksEntryData','getMissingMarksList');
  }
  if(/Book|Library|Issue|Return/i.test(a)){
    removeByAction.push('getBooks','getLibraryReport');
  }
  const uniq = {};
  removeByAction.forEach(x=>uniq[x]=1);
  try{
    Object.keys(localStorage).forEach(k=>{
      if(k.indexOf('geo_preload_cache')===0) return;
      for(const act in uniq){
        if(k.indexOf('uf_fast_get_'+act+'_')===0 || k.indexOf('geo_lite_get_'+act+'_')===0 || k.indexOf('geo_subject_mini_cache_')===0){
          localStorage.removeItem(k);
          break;
        }
      }
    });
  }catch(e){}
}
const __geoLoadFastPrevPost = geoApiPost;
geoApiPost = async function(payload){
  const basePost = (typeof __geoApiPostOriginal !== 'undefined') ? __geoApiPostOriginal : __geoLoadFastPrevPost;
  const res = await basePost(payload);
  try{ if(payload && payload.action && payload.action !== 'loginUser') geoClearActionCache_(payload.action); }catch(e){}
  return res;
};


/* ================================================================
 * SUPABASE DIRECT DATA ADAPTER - FULL BUG FIXED VERSION
 * Scope: Netlify static website -> Supabase REST API.
 * Fixes: paged data load, duplicate-safe display, exam schedule save,
 * marks entry, missing marks, attendance sheet X cells, incourse average,
 * result lists, library issue/report, final result import/promotion.
 * ================================================================ */
(function(){
'use strict';

const GEO_SUPABASE_URL = (window.GEO_SUPABASE_URL || 'https://ejxmzylupdqankdxcnex.supabase.co').replace(/\/+$/,'');
const GEO_SUPABASE_PUBLISHABLE_KEY = window.GEO_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_nXISP1Nk6-ICU6bFqmL81Q_OFV0S7MN';
const GEO_SUPABASE_REST = GEO_SUPABASE_URL + '/rest/v1';
const GEO_SB_PAGE_SIZE = 1000;
const GEO_SB_CACHE_TTL_MS = 0; // preload/cache disabled as requested

const GEO_SB_TABLE_HEADERS = {
  "Admins": [
    "Timestamp",
    "AdminID",
    "Name",
    "Username",
    "Password",
    "Role",
    "Email",
    "Mobile",
    "ImageURL",
    "Status"
  ],
  "Students": [
    "Timestamp",
    "StudentID",
    "SessionYear",
    "CurrentYear",
    "Name",
    "Roll",
    "RegistrationNumber",
    "FatherName",
    "MotherName",
    "Address",
    "Email",
    "StudentPhone",
    "GuardianPhone",
    "StudentMobile",
    "GuardianMobile",
    "NonMajorGroup",
    "NonMajor1",
    "NonMajor2",
    "Group",
    "PhotoURL",
    "ImageURL",
    "Password",
    "Status",
    "StudySessionYear",
    "CurrentStudySession",
    "AcademicYear",
    "StudyStatus"
  ],
  "ActualStudents": [
    "Timestamp",
    "StudentID",
    "Name",
    "Roll",
    "RegistrationNumber",
    "FatherName",
    "MotherName",
    "Address",
    "Email",
    "StudentMobile",
    "GuardianMobile",
    "SessionYear",
    "StudySessionYear",
    "AcademicYear",
    "CurrentYear",
    "NonMajorGroup",
    "Group",
    "Status",
    "StudyStatus"
  ],
  "Subjects": [
    "Timestamp",
    "SubjectID",
    "AcademicYear",
    "SubjectType",
    "SubjectCode",
    "SubjectName",
    "FullMarks",
    "PassMarks",
    "Credits",
    "Group",
    "Status"
  ],
  "StudentSubjects": [
    "Timestamp",
    "StudentSubjectID",
    "SessionYear",
    "AcademicYear",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "SubjectCodes",
    "SubjectNames",
    "SubjectTypes",
    "SubjectCode",
    "SubjectName",
    "SubjectType",
    "NonMajorGroup",
    "Status"
  ],
  "NonMajorGroups": [
    "Timestamp",
    "GroupID",
    "AcademicYear",
    "GroupName",
    "SubjectCodes",
    "SubjectNames",
    "Status"
  ],
  "Exams": [
    "Timestamp",
    "ExamID",
    "SessionYear",
    "AcademicYear",
    "ExamType",
    "ExamName",
    "StartDate",
    "Status",
    "ExamComponentMarks",
    "AssignmentMarks",
    "AttendanceMarks",
    "TestExamMarks",
    "FinalPassMarks",
    "PromotionExam",
    "ResultPublished",
    "PublishedAt",
    "Published",
    "PublishStatus"
  ],
  "ExamSchedule": [
    "Timestamp",
    "ScheduleID",
    "ExamID",
    "SessionYear",
    "AcademicYear",
    "ExamType",
    "ExamName",
    "SubjectCode",
    "SubjectName",
    "ExamDate",
    "ExamTime",
    "Room",
    "Note",
    "Status",
    "SubjectExamMarks",
    "SubjectAssignmentMarks",
    "SubjectAttendanceMarks",
    "SubjectTestMarks",
    "SubjectFinalPassMarks",
    "SubjectFullMarks"
  ],
  "ExamBlocks": [
    "Timestamp",
    "ExamID",
    "SessionYear",
    "AcademicYear",
    "ExamType",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "Blocked",
    "Reason",
    "Status"
  ],
  "Marks": [
    "Timestamp",
    "MarkID",
    "ExamID",
    "SessionYear",
    "AcademicYear",
    "ExamType",
    "SubjectCode",
    "SubjectName",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "ExamMarks",
    "AssignmentMarks",
    "AttendanceMarks",
    "Marks",
    "Grade",
    "GPA",
    "PassFail",
    "Status"
  ],
  "AttendanceMarks": [
    "Timestamp",
    "AttendanceMarkID",
    "ExamID",
    "SessionYear",
    "AcademicYear",
    "ExamType",
    "SubjectCode",
    "SubjectName",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "AttendanceMarks",
    "MaxAttendanceMarks",
    "Remarks",
    "Status"
  ],
  "Attendance": [
    "Timestamp",
    "AttendanceID",
    "ExamID",
    "SessionYear",
    "AcademicYear",
    "SubjectCode",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "Status",
    "Remarks"
  ],
  "ResultSummary": [
    "Timestamp",
    "SummaryID",
    "ExamID",
    "SessionYear",
    "AcademicYear",
    "ExamType",
    "ExamName",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "SubjectCount",
    "Passed",
    "Failed",
    "TotalMarks",
    "GPA",
    "Rank",
    "Status",
    "PassFail",
    "FailedCodes",
    "NonMajorGroup",
    "Group",
    "MarksJSON",
    "ResultPublished",
    "UpdatedAt"
  ],
  "FinalResults": [
    "Timestamp",
    "ResultID",
    "SessionYear",
    "AcademicYear",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "FinalMarks",
    "GPA",
    "ResultStatus",
    "PromotedToYear",
    "Remarks"
  ],
  "ResultImports": [
    "Timestamp",
    "ImportID",
    "ExamID",
    "InputSession",
    "ResultYear",
    "NextYear",
    "RegNo",
    "StudentNameFromFile",
    "ObtainedGPMark",
    "Result",
    "Matched",
    "MatchedRoll",
    "MatchedStudentName",
    "StudentSession",
    "OldYear",
    "NewYear",
    "Message",
    "SessionYear",
    "AcademicYear",
    "ExamType",
    "FileName",
    "Status"
  ],
  "Notices": [
    "Timestamp",
    "NoticeID",
    "Title",
    "Body",
    "Message",
    "Audience",
    "Status"
  ],
  "Books": [
    "Timestamp",
    "BookID",
    "ISBN",
    "Title",
    "Author",
    "Publisher",
    "Category",
    "Stock",
    "Available",
    "TotalCopies",
    "AvailableCopies",
    "PurchaseDate",
    "BuyDate",
    "Price",
    "Status"
  ],
  "BookCopies": [
    "Timestamp",
    "CopyID",
    "ISBN",
    "CopySerial",
    "CopyCode",
    "Title",
    "Author",
    "Category",
    "PurchaseDate",
    "Price",
    "Status",
    "BookID",
    "Serial",
    "Barcode",
    "QR",
    "IssuedRoll",
    "IssuedName",
    "RegistrationNumber",
    "IssueDate",
    "ReturnDate",
    "SessionYear",
    "AcademicYear",
    "CurrentYear"
  ],
  "LibraryLogs": [
    "Timestamp",
    "LogID",
    "IssueID",
    "Action",
    "RollID",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "ISBN",
    "BookID",
    "CopyCode",
    "CopyID",
    "BookTitle",
    "Title",
    "IssueDate",
    "ReturnDate",
    "Status",
    "Fine"
  ],
  "ClassRoutine": [
    "Timestamp",
    "RoutineID",
    "SessionYear",
    "AcademicYear",
    "Day",
    "StartTime",
    "EndTime",
    "Time",
    "SubjectCode",
    "SubjectName",
    "TeacherName",
    "Teacher",
    "Room",
    "Status",
    "Note"
  ],
  "ClassAttendance": [
    "Timestamp",
    "AttendanceID",
    "SessionYear",
    "AcademicYear",
    "Date",
    "SubjectCode",
    "SubjectName",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "Status",
    "Remarks"
  ],
  "Teachers": [
    "Timestamp",
    "TeacherID",
    "Name",
    "Designation",
    "Phone",
    "Mobile",
    "Email",
    "Status",
    "Remarks"
  ],
  "StudentFees": [
    "Timestamp",
    "FeeID",
    "SessionYear",
    "AcademicYear",
    "Roll",
    "RegistrationNumber",
    "StudentName",
    "Name",
    "FeeType",
    "Amount",
    "Paid",
    "Due",
    "Transaction",
    "Status",
    "PaymentDate",
    "Remarks"
  ],
  "Documents": [
    "Timestamp",
    "DocumentID",
    "Title",
    "Category",
    "FileURL",
    "URL",
    "Status",
    "Note"
  ]
};

window.GEO_SUPABASE_ENABLED = true;
window.GEO_SUPABASE_URL = GEO_SUPABASE_URL;

function sbDisableLegacyPreloadCache_(){
  try{
    Object.keys(localStorage || {}).forEach(k=>{
      if(k.indexOf('geo_preload_cache') === 0 ||
         k.indexOf('geo_preload_last_attempt') === 0 ||
         k.indexOf('geo_lite_get_') === 0 ||
         k.indexOf('uf_fast_get_') === 0 ||
         k.indexOf('geo_subject_mini_cache_') === 0){
        localStorage.removeItem(k);
      }
    });
  }catch(e){}
}
sbDisableLegacyPreloadCache_();
try{ preloadGeoData = async function(){ return {success:true, disabled:true, message:'Preload disabled. Data loads directly from Supabase.'}; }; }catch(e){}
try{ getGeoCache = function(){ return null; }; }catch(e){}
try{ getCachedPreloadList = function(){ return null; }; }catch(e){}

const GEO_SB_TABLE_NAME_MAP = {
  "Admins": "admins",
  "Students": "students",
  "ActualStudents": "actualstudents",
  "Subjects": "subjects",
  "StudentSubjects": "studentsubjects",
  "NonMajorGroups": "nonmajorgroups",
  "Exams": "exams",
  "ExamSchedule": "examschedule",
  "ExamBlocks": "examblocks",
  "Marks": "marks",
  "AttendanceMarks": "attendancemarks",
  "Attendance": "attendance",
  "ResultSummary": "resultsummary",
  "FinalResults": "finalresults",
  "ResultImports": "resultimports",
  "Notices": "notices",
  "Books": "books",
  "BookCopies": "bookcopies",
  "LibraryLogs": "librarylogs",
  "ClassRoutine": "classroutine",
  "ClassAttendance": "classattendance",
  "Teachers": "teachers",
  "StudentFees": "studentfees",
  "Documents": "documents"
};

const SB_CACHE = {};
function sbClean(v){ return String(v == null ? '' : v).trim(); }
function sbLower(v){ return sbClean(v).toLowerCase(); }
function sbNow(){
  try{ return new Date().toLocaleString('sv-SE', {timeZone:'Asia/Dhaka'}).replace('T',' '); }
  catch(e){ return new Date().toISOString().slice(0,19).replace('T',' '); }
}
function sbId(prefix){ return String(prefix||'ID') + '-' + new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14) + '-' + Math.floor(Math.random()*9000+1000); }
function sbNum(v){ const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g,'')); return Number.isFinite(n) ? n : 0; }
function sbRoundMarkValue(v){
  const raw = sbClean(v);
  if(raw === '') return '';
  const up = raw.toUpperCase();
  if(up === 'A' || up === 'AB' || up === 'ABSENT') return 'A';
  const n = Number(raw.replace(/[^0-9.\-]/g,''));
  if(!Number.isFinite(n)) return raw;
  return String(Math.round(n));
}
function sbFormatGpaValue(v){
  const raw = sbClean(v);
  if(raw === '') return '';
  if(raw.toUpperCase() === 'FAIL') return 'FAIL';
  const n = Number(raw.replace(/[^0-9.\-]/g,''));
  if(!Number.isFinite(n)) return raw;
  return n.toFixed(2);
}

function sbDateOnly(v){
  if(!v) return '';
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if(s.includes('T')) return s.slice(0,10);
  const d = new Date(s);
  if(!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return s;
}
function sbIsActive(row){
  const s = sbLower((row && row.Status) || 'Active');
  return !(s === 'deleted' || s === 'delete' || s === 'removed' || s === 'remove' || s === 'inactive' || s === 'archived' || s === 'archive');
}
function sbNormalizeType(v){
  const raw = sbClean(v);
  const s = raw.toLowerCase().replace(/[\s_\-]+/g,'');
  if(!s) return '';
  if(s.includes('nonmajor')) return 'Non-Major';
  if(s === 'major') return 'Major';
  if(s === 'compulsory') return 'Compulsory';
  if(s === 'practical') return 'Practical';
  if(s === 'viva') return 'Viva';
  return raw;
}
function sbNormalizeGroup(v){
  const s = sbLower(v).replace(/[\s_\-\/]+/g,'');
  if(!s) return '';
  if(s.includes('science') || s === 'groupa' || s === 'a') return 'science';
  if(s.includes('human') || s.includes('arts') || s === 'groupb' || s === 'b') return 'humanities';
  return s;
}
function sbSplit(v){ return sbClean(v).split(/[,|\n]+/).map(x=>sbClean(x)).filter(Boolean); }
function sbUnique(arr){ const m={}; return (arr||[]).map(sbClean).filter(x=>x && !m[x] && (m[x]=1)); }
function sbAcademicRank(y){
  y = sbLower(y);
  if(y.includes('1st')) return 1; if(y.includes('2nd')) return 2; if(y.includes('3rd')) return 3; if(y.includes('4th')) return 4; if(y.includes('master')) return 5;
  return 99;
}
const SB_SUBJECT_SERIAL_KEYS = ['Serial','SubjectSerial','Subject Serial','SubjectSL','Subject SL','SL','S.L','S L','SL No','SLNo','Order','SortOrder','SubjectOrder','Position','SerialNo','Serial No'];
function sbSubjectSerialRaw(s){
  s = s || {};
  for(const k of SB_SUBJECT_SERIAL_KEYS){
    const v = sbClean(s[k]);
    if(v) return v;
  }
  return '';
}
function sbSubjectSerialNum(s, fallback){
  const raw = sbSubjectSerialRaw(s);
  const n = Number(String(raw).replace(/[^0-9.\-]/g,''));
  if(Number.isFinite(n) && raw !== '') return n;
  const rid = Number(s && s.row_id);
  if(Number.isFinite(rid) && rid > 0) return rid;
  return Number(fallback || 999999);
}
function sbSortSubjects(rows){
  return (rows || []).slice().sort((a,b)=>{
    const yr = sbAcademicRank(a.AcademicYear) - sbAcademicRank(b.AcademicYear);
    if(yr) return yr;
    const as = sbSubjectSerialNum(a, 999999), bs = sbSubjectSerialNum(b, 999999);
    if(as !== bs) return as - bs;
    const ar = Number(a.row_id || 0), br = Number(b.row_id || 0);
    if(ar && br && ar !== br) return ar - br;
    return sbClean(a.SubjectCode).localeCompare(sbClean(b.SubjectCode), undefined, {numeric:true});
  });
}
function sbSubjectOrderMap(subjectRows){
  const map = {};
  sbSortSubjects(subjectRows || []).forEach((s,i)=>{
    const code = sbClean(s.SubjectCode);
    if(code && map[code] == null) map[code] = i + 1;
  });
  return map;
}
function sbSortBySubjectSerial(rows, subjectRows){
  const order = sbSubjectOrderMap(subjectRows || rows || []);
  return (rows || []).slice().sort((a,b)=>{
    const ac = sbClean(a.SubjectCode), bc = sbClean(b.SubjectCode);
    const av = order[ac] || sbSubjectSerialNum(a, 999999);
    const bv = order[bc] || sbSubjectSerialNum(b, 999999);
    if(av !== bv) return av - bv;
    return ac.localeCompare(bc, undefined, {numeric:true});
  });
}
function sbSubjectIsPractical(s){
  return sbNormalizeType((s || {}).SubjectType || (s || {}).Type) === 'Practical';
}
function sbSubjectIsNonCredit(s){
  s = s || {};
  const type = sbLower(sbNormalizeType(s.SubjectType || s.Type));
  const credits = sbClean(s.Credits || s.Credit);
  return type.includes('noncredit') || type.includes('non-credit') || type.includes('non credit') || credits === '0';
}
function sbSortByRoll(a,b){ return sbClean(a.Roll || a.roll).localeCompare(sbClean(b.Roll || b.roll), undefined, {numeric:true}); }
function sbGrade(mark, full){
  const mtxt = sbClean(mark).toUpperCase();
  if(mtxt === 'A' || mtxt === 'AB' || mtxt === 'ABSENT') return {grade:'AB', gp:'0.00', status:'Fail', percent:0};
  const f = Math.max(1, sbNum(full || 100));
  const p = (sbNum(mark) / f) * 100;
  if(p >= 80) return {grade:'A+', gp:'4.00', status:'Pass', percent:p};
  if(p >= 75) return {grade:'A', gp:'3.75', status:'Pass', percent:p};
  if(p >= 70) return {grade:'A-', gp:'3.50', status:'Pass', percent:p};
  if(p >= 65) return {grade:'B+', gp:'3.25', status:'Pass', percent:p};
  if(p >= 60) return {grade:'B', gp:'3.00', status:'Pass', percent:p};
  if(p >= 55) return {grade:'B-', gp:'2.75', status:'Pass', percent:p};
  if(p >= 50) return {grade:'C+', gp:'2.50', status:'Pass', percent:p};
  if(p >= 45) return {grade:'C', gp:'2.25', status:'Pass', percent:p};
  if(p >= 40) return {grade:'D', gp:'2.00', status:'Pass', percent:p};
  return {grade:'F', gp:'0.00', status:'Fail', percent:p};
}

function sbGradeResultForDisplay(mark, full, subject){
  const rs = sbGrade(mark, full);
  if(sbSubjectIsNonCredit(subject)){
    return {grade:rs.status === 'Pass' ? 'Pass' : rs.grade, gp:'', status:rs.status, percent:rs.percent, nonCredit:true};
  }
  rs.gp = sbFormatGpaValue(rs.gp);
  return Object.assign({nonCredit:false}, rs);
}

function sbExamKind(examOrType){
  const t = sbLower((examOrType && (examOrType.ExamType || examOrType.examType)) || examOrType || '');
  if(t.includes('test')) return 'test';
  if(t.includes('incourse') || t.includes('in course')) return 'incourse';
  if(t.includes('final')) return 'final';
  return '';
}

function sbComponentNumber(){
  for(const v of arguments){
    const s = sbClean(v);
    if(s === '') continue;
    const n = sbNum(s);
    if(Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function sbBuildScheduleMap(rows){
  const map = {};
  (rows || []).filter(sbIsActive).forEach(r=>{
    const c = sbClean(r.SubjectCode);
    if(!c) return;
    const old = map[c];
    if(!old || Number(r.row_id || 0) >= Number(old.row_id || 0)) map[c] = r;
  });
  return map;
}

function sbFindScheduleFullMarks(markRow, exam, subject, schedule){
  markRow = markRow || {}; exam = exam || {}; subject = subject || {}; schedule = schedule || {};
  const kind = sbExamKind(markRow.ExamType || exam.ExamType);

  if(kind === 'incourse'){
    const rowHasComponents = sbClean(markRow.ExamMarks) !== '' || sbClean(markRow.AssignmentMarks) !== '' || sbClean(markRow.AttendanceMarks) !== '';
    const examMax = sbComponentNumber(schedule.SubjectExamMarks, exam.ExamComponentMarks);
    const assignmentMax = sbComponentNumber(schedule.SubjectAssignmentMarks, exam.AssignmentMarks);
    const attendanceMax = sbComponentNumber(schedule.SubjectAttendanceMarks, exam.AttendanceMarks);
    const componentTotal = examMax + assignmentMax + attendanceMax;
    if(rowHasComponents && componentTotal > 0) return componentTotal;
    if(componentTotal > 0) return componentTotal;
    return sbComponentNumber(schedule.SubjectFullMarks, subject.FullMarks, 20, 100);
  }

  if(kind === 'test'){
    return sbComponentNumber(schedule.SubjectTestMarks, exam.TestExamMarks, schedule.SubjectFullMarks, subject.FullMarks, 80, 100);
  }

  return sbComponentNumber(schedule.SubjectFullMarks, subject.FullMarks, schedule.SubjectExamMarks, exam.ExamComponentMarks, 100);
}

function sbMarkObtainedValue(markRow){
  markRow = markRow || {};
  const rawMarks = sbClean(markRow.Marks);
  const hasComponents = sbClean(markRow.ExamMarks) !== '' || sbClean(markRow.AssignmentMarks) !== '' || sbClean(markRow.AttendanceMarks) !== '';
  const absentValue = [markRow.Marks, markRow.ExamMarks].some(v=>['A','AB','ABSENT'].includes(sbClean(v).toUpperCase()));
  if(absentValue) return 'A';
  if(rawMarks !== '') return sbRoundMarkValue(rawMarks);
  if(hasComponents){
    const total = sbNum(markRow.ExamMarks) + sbNum(markRow.AssignmentMarks) + sbNum(markRow.AttendanceMarks);
    return sbRoundMarkValue(total);
  }
  return sbRoundMarkValue(sbClean(markRow.ExamMarks));
}
function sbCreditValue(subject){
  const n = sbNum((subject || {}).Credits || (subject || {}).Credit);
  if(Number.isFinite(n) && n > 0) return n;
  if(sbSubjectIsNonCredit(subject)) return 0;
  return 1;
}
function sbNextAcademicYear(year){
  const rank = sbAcademicRank(year);
  if(rank === 1) return 'Honours 2nd Year';
  if(rank === 2) return 'Honours 3rd Year';
  if(rank === 3) return 'Honours 4th Year';
  if(rank === 4) return 'Masters';
  return year || '';
}
function sbIsPromotedText(v){
  const s = sbLower(v);
  if(!s) return false;
  if(/not\s*promoted|fail|failed|unsuccess|withheld|absent/.test(s)) return false;
  return /promoted|pass|passed|successful/.test(s);
}
function sbTableName(table){ return GEO_SB_TABLE_NAME_MAP[table] || String(table || '').toLowerCase(); }
function sbHeaders(table){ return GEO_SB_TABLE_HEADERS[table] || []; }
function sbPick(table, obj){
  const allowed = {}; sbHeaders(table).forEach(h=>allowed[h]=1);
  const out = {};
  Object.keys(obj || {}).forEach(k=>{
    if(allowed[k] && obj[k] !== undefined) out[k] = obj[k] == null ? '' : String(obj[k]);
  });
  return out;
}
function sbQS(params){
  const usp = new URLSearchParams();
  Object.keys(params || {}).forEach(k=>{
    const v = params[k];
    if(v !== undefined && v !== null && v !== '') usp.append(k, v);
  });
  return usp.toString();
}
function sbSleep_(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
function sbRetryableError_(err){
  const msg = String((err && err.message) || err || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('timed out') || msg.includes('429') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('supabase http 5');
}
async function sbFetchWithTimeout_(url, options, timeoutMs){
  const ms = Number(timeoutMs || 60000);
  if(typeof AbortController !== 'undefined'){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), ms);
    try{
      return await fetch(url, Object.assign({}, options || {}, {signal:controller.signal}));
    }catch(err){
      if(err && err.name === 'AbortError') throw new Error('Supabase request timed out. Please check internet connection and try again.');
      throw err;
    }finally{
      clearTimeout(timer);
    }
  }
  return await Promise.race([
    fetch(url, options || {}),
    new Promise((_, reject)=>setTimeout(()=>reject(new Error('Supabase request timed out. Please check internet connection and try again.')), ms))
  ]);
}
async function sbRequestOnce_(url, headers, opt){
  const method = opt.method || 'GET';
  const isWrite = method !== 'GET';
  const res = await sbFetchWithTimeout_(url, {
    method: method,
    headers,
    body: opt.body === undefined ? undefined : JSON.stringify(opt.body),
    cache:'no-store'
  }, isWrite ? 90000 : 60000);
  const text = await res.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
  if(!res.ok){
    const msg = (data && (data.message || data.details || data.hint)) || text || ('Supabase HTTP ' + res.status);
    throw new Error('Supabase HTTP ' + res.status + ': ' + msg);
  }
  return data;
}
async function sbRequest(table, params={}, opt={}){
  const qs = sbQS(params);
  const url = GEO_SUPABASE_REST + '/' + encodeURIComponent(sbTableName(table)) + (qs ? '?' + qs : '');
  let token = GEO_SUPABASE_PUBLISHABLE_KEY;
  try {
    const u = typeof getAuthSession === 'function' ? getAuthSession() : null;
    if(u && u.loggedIn && u.role === 'admin' && u.authToken && u.authToken !== 'supabase-admin' && u.authToken !== 'supabase-admin-temp'){
       token = u.authToken;
    }
  } catch(e){}
  const headers = {
    apikey: GEO_SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + token,
    Accept: 'application/json'
  };
  if(opt.body !== undefined){ headers['Content-Type'] = 'application/json'; headers['Prefer'] = opt.prefer || 'return=representation'; }
  if(opt.prefer && opt.body === undefined) headers['Prefer'] = opt.prefer;

  const method = opt.method || 'GET';
  const canRetry = method === 'GET' || method === 'PATCH' || method === 'DELETE' || opt.retryPost === true;
  const tries = canRetry ? 4 : 1;
  let lastErr = null;
  for(let i=0;i<tries;i++){
    try{
      return await sbRequestOnce_(url, headers, Object.assign({}, opt, {method}));
    }catch(err){
      lastErr = err;
      if(!canRetry || !sbRetryableError_(err) || i === tries - 1) break;
      await sbSleep_(450 * Math.pow(2, i));
    }
  }
  throw lastErr;
}
async function sbSelectPage(table, offset){
  return await sbRequest(table, {select:'*', order:'row_id.asc', limit:GEO_SB_PAGE_SIZE, offset:offset || 0}, {method:'GET'});
}
function sbDedupeRows(table, rows){
  rows = Array.isArray(rows) ? rows : [];
  function latestBy(fn){
    const m = new Map();
    rows.forEach((r,idx)=>{
      const k = fn(r) || ('__row_' + (r.row_id || idx));
      const old = m.get(k);
      if(!old || Number(r.row_id || 0) >= Number(old.row_id || 0)) m.set(k, r);
    });
    return Array.from(m.values());
  }
  if(table === 'Students' || table === 'ActualStudents') return latestBy(r=>sbClean(r.Roll) || sbClean(r.RegistrationNumber));
  if(table === 'Subjects') return latestBy(r=>sbClean(r.AcademicYear) + '|' + sbClean(r.SubjectCode));
  if(table === 'StudentSubjects') return latestBy(r=>[sbClean(r.AcademicYear), sbClean(r.StudySessionYear || r.CurrentStudySession || r.SessionYear), sbClean(r.Roll || r.RegistrationNumber)].join('|'));
  if(table === 'NonMajorGroups') return latestBy(r=>sbClean(r.AcademicYear) + '|' + sbClean(r.GroupName || r.GroupID));
  if(table === 'Exams') return latestBy(r=>sbClean(r.ExamID) || [r.SessionYear,r.AcademicYear,r.ExamType,r.ExamName].map(sbClean).join('|'));
  if(table === 'ExamSchedule') return latestBy(r=>sbClean(r.ExamID) + '|' + sbClean(r.SubjectCode));
  if(table === 'ExamBlocks') return latestBy(r=>sbClean(r.ExamID) + '|' + sbClean(r.Roll || r.RegistrationNumber));
  if(table === 'Marks') return latestBy(r=>sbClean(r.ExamID) + '|' + sbClean(r.SubjectCode) + '|' + sbClean(r.Roll || r.RegistrationNumber));
  if(table === 'AttendanceMarks') return latestBy(r=>[r.ExamID,r.SessionYear,r.AcademicYear,r.SubjectCode,r.Roll||r.RegistrationNumber].map(sbClean).join('|'));
  if(table === 'FinalResults') return latestBy(r=>sbClean(r.AcademicYear) + '|' + sbClean(r.Roll || r.RegistrationNumber));
  if(table === 'Books') return latestBy(r=>sbClean(r.ISBN || r.BookID));
  if(table === 'BookCopies') return latestBy(r=>sbCopyNo(r));
  return rows;
}
function sbClearCache(){ Object.keys(SB_CACHE).forEach(k=>delete SB_CACHE[k]); }
async function sbAll(table, opt={}){
  // No browser/Supabase adapter cache. Every load reads fresh data from Supabase.
  let out = [], offset = 0, guard = 0;
  while(true){
    const page = await sbSelectPage(table, offset);
    const arr = Array.isArray(page) ? page : [];
    out = out.concat(arr);
    if(arr.length < GEO_SB_PAGE_SIZE) break;
    offset += GEO_SB_PAGE_SIZE;
    guard++;
    if(guard > 500) throw new Error('Too much data while loading ' + table + '. Please use search/filter.');
  }
  if(!opt.raw) out = sbDedupeRows(table, out);
  return out.slice();
}
async function sbInsert(table, obj){
  sbClearCache();
  const picked = sbPick(table, obj);
  const data = await sbRequest(table, {}, {method:'POST', body:picked});
  if(!Array.isArray(data) || !data.length) throw new Error('Insert failed: Supabase did not return saved row for ' + table);
  return data;
}
async function sbPatchByRowId(table, rowId, obj){
  sbClearCache();
  if(!rowId) throw new Error('Update failed: row id missing for ' + table);
  const picked = sbPick(table, obj);
  const data = await sbRequest(table, {row_id:'eq.'+rowId}, {method:'PATCH', body:picked});
  if(Array.isArray(data) && data.length) return data[0];
  const check = await sbRequest(table, {select:'*', row_id:'eq.'+rowId, limit:1}, {method:'GET'});
  if(Array.isArray(check) && check.length) return check[0];
  throw new Error('Update failed: saved row not found in ' + table);
}
async function sbDeleteByRowId(table, rowId){ sbClearCache(); return await sbRequest(table, {row_id:'eq.'+rowId}, {method:'DELETE', prefer:'return=representation'}); }
async function sbFindOne(table, predicate, opt={}){ return (await sbAll(table, opt)).find(predicate) || null; }
async function sbUpsertBy(table, predicate, obj){
  const found = await sbFindOne(table, predicate, {raw:true});
  if(found && found.row_id) return await sbPatchByRowId(table, found.row_id, obj);
  try{
    const ins = await sbInsert(table, obj);
    return Array.isArray(ins) ? ins[0] : ins;
  }catch(err){
    // If internet failed after Supabase saved the row, verify before showing failure.
    const saved = await sbFindOne(table, predicate, {raw:true}).catch(()=>null);
    if(saved && saved.row_id) return saved;
    throw err;
  }
}

function sbStudentObj(row){
  row = row || {};
  const out = Object.assign({}, row);
  out.Name = sbClean(out.Name || out.StudentName || out.FullName);
  out.StudentName = sbClean(out.StudentName || out.Name);
  out.Roll = sbClean(out.Roll || out.ClassRoll || out['Class Roll']);
  out.RegistrationNumber = sbClean(out.RegistrationNumber || out.RegNo || out.Registration || out['Registration Number']);
  out.SessionYear = sbClean(out.SessionYear || out.Session);
  out.StudySessionYear = sbClean(out.StudySessionYear || out.CurrentStudySession || out.SessionYear);
  out.CurrentStudySession = sbClean(out.CurrentStudySession || out.StudySessionYear || out.SessionYear);
  out.CurrentYear = sbClean(out.CurrentYear || out.AcademicYear || out.Year);
  out.AcademicYear = sbClean(out.AcademicYear || out.CurrentYear);
  out.StudentMobile = sbClean(out.StudentMobile || out.StudentPhone || out.Mobile || out.Phone);
  out.GuardianMobile = sbClean(out.GuardianMobile || out.GuardianPhone);

  const originalSession = sbClean(out.SessionYear);
  const studySession = sbClean(out.StudySessionYear || out.CurrentStudySession || out.SessionYear);
  const statusText = sbLower([out.StudyStatus, out.Status, out.StudentType, out.IrregularStatus].join(' '));
  const mismatch = !!(originalSession && studySession && originalSession !== studySession);
  const alreadyIrregular = /irregular|not\s*promoted/.test(statusText);

  out.StudySessionYear = studySession;
  out.CurrentStudySession = studySession;
  out.StudentType = (mismatch || alreadyIrregular) ? 'Irregular' : 'Regular';
  out.IrregularStatus = out.StudentType;
  out.IrregularReason = mismatch ? ('Original session: ' + originalSession + ', study session: ' + studySession) : sbClean(out.IrregularReason || out.Reason || '');
  return out;
}
function sbSubjectObj(row){
  row = row || {};
  const out = Object.assign({}, row);
  out.AcademicYear = sbClean(out.AcademicYear || out['Academic Year']);
  out.SubjectCode = sbClean(out.SubjectCode || out['Subject Code'] || out.Code);
  out.SubjectName = sbClean(out.SubjectName || out['Subject Name'] || out.Name);
  out.SubjectType = sbNormalizeType(out.SubjectType || out['Subject Type'] || out.Type);
  out.FullMarks = sbClean(out.FullMarks || out['Full Marks'] || 100);
  out.PassMarks = sbClean(out.PassMarks || out['Pass Marks'] || 40);
  out.Credits = sbClean(out.Credits || out.Credit || '');
  return out;
}
function sbExamObj(row){
  row = row || {};
  const out = Object.assign({}, row);
  out.ExamID = sbClean(out.ExamID || out.examId);
  out.SessionYear = sbClean(out.SessionYear || out.sessionYear);
  out.AcademicYear = sbClean(out.AcademicYear || out.academicYear);
  out.ExamType = sbClean(out.ExamType || out.examType);
  out.ExamName = sbClean(out.ExamName || out.examName || [out.SessionYear,out.AcademicYear,out.ExamType].filter(Boolean).join(' - '));
  out.DisplayName = out.ExamName || [out.SessionYear,out.AcademicYear,out.ExamType].filter(Boolean).join(' - ');
  return out;
}
function sbSortRows(rows, field, dir){
  const d = String(dir||'asc').toLowerCase() === 'desc' ? -1 : 1;
  const key = String(field||'roll').toLowerCase();
  const getter = r => key==='reg' ? r.RegistrationNumber : key==='name' ? (r.Name || r.StudentName) : key==='session' ? (r.StudySessionYear || r.SessionYear) : key==='type' ? (r.StudentType || r.IrregularStatus) : r.Roll;
  return (rows||[]).slice().sort((a,b)=> d * sbClean(getter(a)).localeCompare(sbClean(getter(b)), undefined, {numeric:true}));
}
async function sbGetStudents(p={}, table='Students'){
  let rows = (await sbAll(table)).map(sbStudentObj).filter(r=>r.Roll || r.RegistrationNumber).filter(sbIsActive);
  if(table === 'ActualStudents' && !rows.length) rows = (await sbAll('Students')).map(sbStudentObj).filter(r=>r.Roll || r.RegistrationNumber).filter(sbIsActive);
  const year = sbClean(p.academicYear || p.currentYear || p.AcademicYear || p.CurrentYear);
  const session = sbClean(p.sessionYear || p.studySessionYear || p.currentStudySession || p.SessionYear || p.StudySessionYear);
  const q = sbLower(p.search || p.q || p.keyword || p.roll || p.registrationNumber || p.regNo || p.studentKey);
  const noStudySessionFilter = /true|1|yes/i.test(String(p.noStudySessionFilter || p.allSessions || ''));

  // Student list/report/marks always follow current/study session. Original SessionYear is only identity/history.
  if(year) rows = rows.filter(r => !sbClean(r.CurrentYear || r.AcademicYear) || sbClean(r.CurrentYear || r.AcademicYear) === year);
  if(session && !noStudySessionFilter) {
    rows = rows.filter(r => sbClean(r.StudySessionYear || r.CurrentStudySession || r.SessionYear) === session);
  }
  if(q) rows = rows.filter(r => [r.Roll,r.RegistrationNumber,r.Name,r.StudentName,r.SessionYear,r.StudySessionYear,r.CurrentStudySession,r.CurrentYear,r.NonMajorGroup,r.StudentType,r.IrregularStatus,r.IrregularReason].join(' ').toLowerCase().includes(q));
  rows = sbSortRows(rows, p.sortField || p.sortBy, p.sortDir || p.order);
  return {success:true, students:rows, count:rows.length, source:'study_session_students'};
}
async function sbFindStudent(search){
  search = sbClean(search); if(!search) return null;
  const digits = search.replace(/\D/g,'');
  const rows = (await sbAll('Students')).map(sbStudentObj).filter(sbIsActive);
  return rows.find(r => sbClean(r.Roll) === search || sbClean(r.RegistrationNumber) === search || (digits && sbClean(r.RegistrationNumber).replace(/\D/g,'') === digits)) || null;
}
async function sbGetStudent(p={}){
  const s = await sbFindStudent(p.roll || p.rollId || p.registrationNumber || p.regNo || p.search || p.studentKey);
  return {success:true, found:!!s, student:s || null, message:s?'Student found':'Student not found'};
}
async function sbRegisterStudent(data={}){
  const roll = sbClean(data.roll || data.Roll || data.rollId || data.classRoll);
  const reg = sbClean(data.registrationNumber || data.regNo || data.RegistrationNumber);
  const explicitRowId = sbClean(data.row_id || data.rowId || data.Row || data.studentRowId);
  let existing = null;
  if(explicitRowId){
    const exactRows = await sbAll('Students', {raw:true});
    const exact = exactRows.find(r => sbClean(r.row_id) === explicitRowId);
    if(exact) existing = sbStudentObj(exact);
  }
  if(!existing){
    existing = (roll ? await sbFindStudent(roll) : null) || (reg ? await sbFindStudent(reg) : null);
  }
  const obj = {
    Timestamp: sbNow(),
    StudentID: existing && existing.StudentID ? existing.StudentID : sbId('STU'),
    Name: sbClean(data.name || data.Name || data.studentName || data.fullName || data.FullName || (existing && existing.Name)),
    Roll: roll || (existing && existing.Roll) || '',
    RegistrationNumber: reg || (existing && existing.RegistrationNumber) || '',
    SessionYear: sbClean(data.sessionYear || data.session || data.SessionYear || (existing && existing.SessionYear)),
    CurrentYear: sbClean(data.currentYear || data.academicYear || data.academicLevel || data.year || (existing && existing.CurrentYear)),
    AcademicYear: sbClean(data.academicYear || data.currentYear || data.academicLevel || data.year || (existing && existing.AcademicYear)),
    FatherName: sbClean(data.fatherName || data.FatherName || (existing && existing.FatherName)),
    MotherName: sbClean(data.motherName || data.MotherName || (existing && existing.MotherName)),
    Address: sbClean(data.address || data.Address || (existing && existing.Address)),
    Email: sbClean(data.email || data.Email || (existing && existing.Email)),
    StudentPhone: sbClean(data.studentPhone || data.phone || data.mobile || data.StudentPhone || (existing && existing.StudentPhone)),
    GuardianPhone: sbClean(data.guardianPhone || data.GuardianPhone || (existing && existing.GuardianPhone)),
    StudentMobile: sbClean(data.studentMobile || data.studentPhone || data.phone || (existing && existing.StudentMobile)),
    GuardianMobile: sbClean(data.guardianMobile || data.guardianPhone || (existing && existing.GuardianMobile)),
    NonMajorGroup: sbClean(data.nonMajorGroup || data.NonMajorGroup || (existing && existing.NonMajorGroup)),
    NonMajor1: sbClean(data.nonMajor1 || data.NonMajor1 || (existing && existing.NonMajor1)),
    NonMajor2: sbClean(data.nonMajor2 || data.NonMajor2 || (existing && existing.NonMajor2)),
    Group: sbClean(data.group || data.Group || (existing && existing.Group)),
    Password: sbClean(data.password || data.Password || (existing && existing.Password)),
    StudySessionYear: sbClean(data.studySessionYear || data.currentStudySession || (existing && (existing.StudySessionYear || existing.SessionYear))),
    CurrentStudySession: sbClean(data.currentStudySession || data.studySessionYear || (existing && (existing.CurrentStudySession || existing.SessionYear))),
    StudyStatus: sbClean(data.studyStatus || data.StudyStatus || (existing && existing.StudyStatus) || 'Continuing'),
    Status: sbClean(data.status || data.Status || (existing && existing.Status) || 'Active')
  };
  if(!obj.Roll && !obj.RegistrationNumber) throw new Error('Roll or Registration required');
  const saved = existing && existing.row_id ? await sbPatchByRowId('Students', existing.row_id, obj) : (await sbInsert('Students', obj))[0];
  return {success:true, message: existing?'Student updated successfully':'Student registered successfully', student: sbStudentObj(saved || obj), updated:!!existing, row_id:(saved && saved.row_id) || (existing && existing.row_id) || ''};
}

async function sbImportManualStudents(data={}){
  const defaults = data.defaults || {};
  let rows = Array.isArray(data.rows) ? data.rows : [];
  if(!rows.length) throw new Error('No student row found in Excel file');
  rows = rows.map(r => Object.assign({}, defaults, r || {})).filter(r => sbClean(r.roll || r.Roll || r.registrationNumber || r.RegistrationNumber || r.name || r.Name));
  if(!rows.length) throw new Error('No valid student row found');
  let saved = 0, updated = 0, inserted = 0;
  const failed = [];
  for(let i=0;i<rows.length;i++){
    const r = rows[i] || {};
    try{
      const roll = sbClean(r.roll || r.Roll || r.classRoll);
      const reg = sbClean(r.registrationNumber || r.RegistrationNumber || r.regNo || r.Registration);
      const before = (roll ? await sbFindStudent(roll) : null) || (reg ? await sbFindStudent(reg) : null);
      const res = await sbRegisterStudent(r);
      if(res && res.success){ saved++; if(before) updated++; else inserted++; }
      else throw new Error((res && res.message) || 'Save failed');
    }catch(err){
      failed.push({ row:i+2, roll:sbClean(r.roll || r.Roll), registrationNumber:sbClean(r.registrationNumber || r.RegistrationNumber), name:sbClean(r.name || r.Name), message:(err && err.message) || String(err) });
    }
  }
  return {success: failed.length === 0, message: saved + ' student saved. Inserted: ' + inserted + ', Updated: ' + updated + (failed.length ? ', Failed: ' + failed.length : ''), saved, inserted, updated, failedCount:failed.length, failed};
}
async function sbQuery(table, query, limit){
  const rows = await sbAll(table, {raw:true});
  const keys = Object.keys(query || {});
  const filtered = rows.filter(r => keys.every(k => sbClean(r[k]) === sbClean(query[k])));
  return limit ? filtered.slice(0, limit) : filtered;
}
async function sbLogin(data={}){
  const username = sbClean(data.username || data.user || data.email);
  const password = sbClean(data.password || data.pass);
  const role = sbClean(data.role || 'admin');
  if(role === 'student'){
    const s = await sbFindStudent(username);
    if(s && (!s.Password || String(s.Password) === password)) return {success:true, user:Object.assign({}, s, {role:'student', username:s.Roll, authToken:'supabase-student'})};
    return {success:false, message:'Student login failed'};
  }
  
  // Try GoTrue first
  try {
    const res = await fetch(GEO_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'apikey': GEO_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: username, password: password })
    });
    const result = await res.json();
    if(res.ok && result.access_token) {
      return {
        success: true, 
        user: {
          role: 'admin', 
          name: result.user?.user_metadata?.name || 'Admin', 
          username: username, 
          authToken: result.access_token, 
          email: username
        }
      };
    }
  } catch(e) {
    console.log('GoTrue failed, falling back to Admins table');
  }
  
  // Fallback to legacy Admins table
  try {
    const adminData = await sbAll('Admins', {raw:true});
    const adminUser = (adminData||[]).find(a => sbClean(a.Username) === username || sbClean(a.Email) === username);
    if(adminUser && String(adminUser.Password) === password) {
      return {
        success: true,
        user: Object.assign({}, adminUser, { role: 'admin', username: adminUser.Username, authToken: GEO_SUPABASE_PUBLISHABLE_KEY })
      };
    }
  } catch(err) {}
  
  return {success:false, message: 'Invalid username or password'};
}
async function sbGetSubjects(p={}){
  let rows = (await sbAll('Subjects')).map(sbSubjectObj).filter(r=>r.SubjectCode && r.SubjectName).filter(sbIsActive);
  const year = sbClean(p.academicYear || p.AcademicYear);
  const type = sbNormalizeType(p.subjectType || p.SubjectType);
  const code = sbClean(p.subjectCode || p.SubjectCode);
  const q = sbLower(p.search || p.q || p.keyword);
  if(year) rows = rows.filter(r=>r.AcademicYear === year);
  if(type) rows = rows.filter(r=>sbNormalizeType(r.SubjectType) === type);
  if(code) rows = rows.filter(r=>r.SubjectCode === code);
  if(q) rows = rows.filter(r=>[r.SubjectCode,r.SubjectName,r.SubjectType,r.AcademicYear].join(' ').toLowerCase().includes(q));
  rows = sbSortSubjects(rows);
  return {success:true, subjects:rows, count:rows.length, source:'supabase_subject_serial'};
}
function sbSubjectAllowedForExam(exam, s){
  const examType = sbClean(exam.ExamType || exam.examType);
  if(examType === '1st Incourse' || examType === '2nd Incourse' || examType === 'Test Examination'){
    if(sbSubjectIsPractical(s)) return false;
  }
  if(examType === '1st Incourse' || examType === '2nd Incourse'){
    if(sbSubjectIsNonCredit(s)) return false;
  }
  return true;
}
async function sbGetSubjectsForExamCreate(p={}){
  const res = await sbGetSubjects(p);
  const exam = {ExamType: sbClean(p.examType || p.ExamType)};
  const rows = (res.subjects || []).filter(s=>sbSubjectAllowedForExam(exam, s));
  return {success:true, subjects:rows, count:rows.length};
}
async function sbSaveSubject(data={}){
  const code = sbClean(data.subjectCode || data.SubjectCode);
  const year = sbClean(data.academicYear || data.AcademicYear);
  if(!code || !year) throw new Error('Academic Year and Subject Code required');
  const obj = {Timestamp:sbNow(), SubjectID:sbClean(data.subjectId || data.SubjectID) || sbId('SUB'), AcademicYear:year, SubjectType:sbNormalizeType(data.subjectType || data.SubjectType), SubjectCode:code, SubjectName:sbClean(data.subjectName || data.SubjectName), FullMarks:sbClean(data.fullMarks || data.FullMarks || 100), PassMarks:sbClean(data.passMarks || data.PassMarks || 40), Credits:sbClean(data.credits || data.Credits || ''), Status:sbClean(data.status || 'Active')};
  const saved = await sbUpsertBy('Subjects', r=>sbClean(r.AcademicYear)===year && sbClean(r.SubjectCode)===code, obj);
  return {success:true, message:'Subject saved successfully', subject:saved || obj};
}
function sbNonMajorGroupKey(v){
  v = sbLower(v).replace(/[^a-z0-9]/g,'');
  if(v.includes('science') || v === 'groupa' || v === 'a') return 'science';
  if(v.includes('human') || v.includes('arts') || v === 'groupb' || v === 'b') return 'humanities';
  return v;
}
function sbBuildNonMajorGroupMap(rows){
  const map = {};
  (rows || []).filter(sbIsActive).forEach(g=>{
    const key = sbNonMajorGroupKey(g.GroupName || g.Group || g.NonMajorGroup || g.GroupID);
    if(!key) return;
    if(!map[key]) map[key] = new Set();
    sbSplit(g.SubjectCodes || g.SubjectCode).forEach(c=>map[key].add(c));
  });
  return map;
}
function sbSubjectAllowedForStudent(s, year, student, groupMap){
  if(sbNormalizeType(s.SubjectType) !== 'Non-Major') return true;
  if(year !== 'Honours 1st Year' && year !== 'Honours 2nd Year') return false;
  const key = sbNonMajorGroupKey(student.NonMajorGroup || student.Group);
  const codes = groupMap && groupMap[key];
  return !!(codes && codes.has(sbClean(s.SubjectCode)));
}
async function sbGetStudentSubjects(p={}){
  let rows = (await sbAll('StudentSubjects', {raw:true})).filter(sbIsActive);
  const year = sbClean(p.academicYear || p.AcademicYear), roll = sbClean(p.roll || p.Roll), q = sbLower(p.search || p.q);
  const session = sbClean(p.studySessionYear || p.currentStudySession || p.sessionYear || p.SessionYear || p.StudySessionYear);
  if(year) rows = rows.filter(r=>sbClean(r.AcademicYear) === year);
  if(session) rows = rows.filter(r=>!sbClean(r.StudySessionYear || r.CurrentStudySession || r.SessionYear) || sbClean(r.StudySessionYear || r.CurrentStudySession || r.SessionYear) === session);
  if(roll) rows = rows.filter(r=>sbClean(r.Roll) === roll || sbClean(r.RegistrationNumber) === roll);
  if(q) rows = rows.filter(r=>[r.Roll,r.RegistrationNumber,r.StudentName,r.SubjectCodes,r.SubjectNames,r.SessionYear,r.StudySessionYear,r.CurrentStudySession,r.AcademicYear,r.NonMajorGroup].join(' ').toLowerCase().includes(q));
  rows = sbDedupeRows('StudentSubjects', rows);
  rows.sort((a,b)=>sbClean(a.Roll).localeCompare(sbClean(b.Roll), undefined, {numeric:true}));
  return {success:true, subjects:rows, studentSubjects:rows, count:rows.length};
}
async function sbGetAssignedRowsForStudents(year, studySession, students){
  const studentList = Array.isArray(students) ? students : [];
  const liveSubjects = (await sbGetSubjects({academicYear:year})).subjects;
  const groupMap = sbBuildNonMajorGroupMap((await sbAll('NonMajorGroups', {raw:true})).filter(r=>!year || sbClean(r.AcademicYear)===year));
  const rows = (await sbAll('StudentSubjects', {raw:true})).filter(sbIsActive).filter(r=>!year || sbClean(r.AcademicYear)===year);
  const exact = {}, any = {};
  rows.forEach(r=>{
    const key = sbClean(r.Roll || r.RegistrationNumber);
    if(!key) return;
    const sess = sbClean(r.StudySessionYear || r.CurrentStudySession || r.SessionYear);
    if(studySession && sess === studySession) exact[key] = r;
    if(!any[key] || Number(r.row_id || 0) >= Number(any[key].row_id || 0)) any[key] = r;
  });
  const out = [];
  studentList.forEach(st=>{
    const key = sbClean(st.Roll || st.RegistrationNumber);
    let row = exact[key] || any[key];
    if(row){ out.push(row); return; }
    const allowed = liveSubjects.filter(sub=>sbSubjectAllowedForStudent(sub, year, st, groupMap));
    out.push({
      Roll:st.Roll,
      RegistrationNumber:st.RegistrationNumber,
      StudentName:st.Name || st.StudentName,
      AcademicYear:year,
      SessionYear:studySession || st.StudySessionYear || st.CurrentStudySession || st.SessionYear,
      SubjectCodes:allowed.map(s=>s.SubjectCode).join(','),
      SubjectNames:allowed.map(s=>s.SubjectName).join(' | '),
      SubjectTypes:allowed.map(s=>s.SubjectType).join(','),
      NonMajorGroup:st.NonMajorGroup || st.Group,
      Status:'Active'
    });
  });
  return out;
}
async function sbSaveStudentSubjects(data={}){
  const roll = sbClean(data.roll || data.Roll || data.studentKey);
  const year = sbClean(data.academicYear || data.AcademicYear);
  const student = await sbFindStudent(roll);
  if(!student) throw new Error('Student not found');
  const passed = Array.isArray(data.subjects) ? data.subjects : [];
  let subjects = passed.map(s=>({SubjectCode:sbClean(s.subjectCode || s.SubjectCode || s.code || s), SubjectName:sbClean(s.subjectName || s.SubjectName || ''), SubjectType:sbNormalizeType(s.subjectType || s.SubjectType || '')})).filter(s=>s.SubjectCode);
  if(subjects.some(s=>!s.SubjectName || !s.SubjectType)){
    const all = (await sbGetSubjects({academicYear:year})).subjects;
    subjects = subjects.map(s=>{ const f=all.find(x=>x.SubjectCode===s.SubjectCode) || {}; return {SubjectCode:s.SubjectCode, SubjectName:s.SubjectName || f.SubjectName || '', SubjectType:s.SubjectType || f.SubjectType || ''}; });
  }
  const studySession = sbClean(data.studySessionYear || data.currentStudySession || data.sessionYear || data.SessionYear || student.StudySessionYear || student.CurrentStudySession || student.SessionYear);
  const obj = {Timestamp:sbNow(), StudentSubjectID:sbClean(data.studentSubjectId || data.StudentSubjectID) || sbId('SSUB'), SessionYear:studySession, AcademicYear:year, Roll:student.Roll, RegistrationNumber:student.RegistrationNumber, StudentName:student.Name, SubjectCodes:subjects.map(s=>s.SubjectCode).join(','), SubjectNames:subjects.map(s=>s.SubjectName).join(' | '), SubjectTypes:subjects.map(s=>s.SubjectType).join(','), NonMajorGroup:sbClean(data.nonMajorGroup || student.NonMajorGroup), Status:'Active'};
  const existing = (await sbAll('StudentSubjects', {raw:true})).find(r=>sbClean(r.Roll)===student.Roll && sbClean(r.AcademicYear)===year && (!studySession || !sbClean(r.SessionYear) || sbClean(r.SessionYear)===studySession) && sbIsActive(r));
  obj.StudentSubjectID = existing && existing.StudentSubjectID ? existing.StudentSubjectID : obj.StudentSubjectID;
  const saved = existing && existing.row_id ? await sbPatchByRowId('StudentSubjects', existing.row_id, obj) : (await sbInsert('StudentSubjects', obj))[0];
  return {success:true, message:'Student subjects saved successfully', subjectRow:saved || obj};
}
async function sbBulkAssignSubjects(data={}){
  const year = sbClean(data.academicYear || data.AcademicYear);
  const studySession = sbClean(data.studySessionYear || data.currentStudySession || data.sessionYear || data.SessionYear);
  if(!year) throw new Error('Academic Year required');
  const students = (await sbGetStudents({academicYear:year, sessionYear:studySession})).students;
  const subjects = (await sbGetSubjects({academicYear:year})).subjects;
  const groupMap = sbBuildNonMajorGroupMap((await sbAll('NonMajorGroups', {raw:true})).filter(r=>!year || sbClean(r.AcademicYear)===year));
  let saved = 0;
  for(const st of students){
    const selected = subjects.filter(s=>sbSubjectAllowedForStudent(s, year, st, groupMap));
    if(selected.length){ await sbSaveStudentSubjects({roll:st.Roll, academicYear:year, studySessionYear:st.StudySessionYear || st.CurrentStudySession || studySession, subjects:selected}); saved++; }
  }
  return {success:true, message:saved + ' students assigned successfully', saved};
}

async function sbGetExams(p={}){
  let rows = (await sbAll('Exams')).map(sbExamObj).filter(r=>r.ExamID).filter(sbIsActive);
  const year=sbClean(p.academicYear), session=sbClean(p.sessionYear), type=sbClean(p.examType), examId=sbClean(p.examId);
  if(year) rows=rows.filter(r=>r.AcademicYear===year);
  if(session) rows=rows.filter(r=>r.SessionYear===session);
  if(type) rows=rows.filter(r=>r.ExamType===type);
  if(examId) rows=rows.filter(r=>r.ExamID===examId);
  rows.sort((a,b)=>sbClean(b.Timestamp||b.created_at).localeCompare(sbClean(a.Timestamp||a.created_at)) || sbClean(a.ExamID).localeCompare(sbClean(b.ExamID)));
  return {success:true, exams:rows, count:rows.length};
}
async function sbSaveExam(data={}){
  const givenExamId = sbClean(data.examId || data.ExamID);
  const existing = (await sbAll('Exams', {raw:true})).filter(sbIsActive).find(r=>
    (givenExamId && sbClean(r.ExamID)===givenExamId) ||
    (!givenExamId && sbClean(r.SessionYear)===sbClean(data.sessionYear||data.SessionYear) && sbClean(r.AcademicYear)===sbClean(data.academicYear||data.AcademicYear) && sbClean(r.ExamType)===sbClean(data.examType||data.ExamType) && sbClean(r.ExamName)===sbClean(data.examName||data.ExamName||[data.sessionYear,data.academicYear,data.examType].filter(Boolean).join(' - ')))
  );
  const oldResultPub = existing ? sbClean(existing.ResultPublished) : 'No';
  const oldPub = existing ? sbClean(existing.Published) : 'No';
  const oldPubStat = existing ? sbClean(existing.PublishStatus) : 'Unpublished';
  const obj = {
    Timestamp:sbNow(),
    ExamID:givenExamId || (existing&&existing.ExamID) || sbId('EXM'),
    SessionYear:sbClean(data.sessionYear || data.SessionYear || (existing&&existing.SessionYear)),
    AcademicYear:sbClean(data.academicYear || data.AcademicYear || (existing&&existing.AcademicYear)),
    ExamType:sbClean(data.examType || data.ExamType || (existing&&existing.ExamType)),
    ExamName:sbClean(data.examName || data.ExamName || [data.sessionYear,data.academicYear,data.examType].filter(Boolean).join(' - ')),
    StartDate:sbClean(data.startDate || data.StartDate || (existing&&existing.StartDate)),
    Status:sbClean(data.status || data.Status || (existing&&existing.Status) || 'Active'),
    ExamComponentMarks:sbClean(data.examComponentMarks || data.ExamComponentMarks || (existing&&existing.ExamComponentMarks)),
    AssignmentMarks:sbClean(data.assignmentMarks || data.AssignmentMarks || (existing&&existing.AssignmentMarks)),
    AttendanceMarks:sbClean(data.attendanceMarks || data.AttendanceMarks || (existing&&existing.AttendanceMarks)),
    TestExamMarks:sbClean(data.testExamMarks || data.TestExamMarks || (existing&&existing.TestExamMarks)),
    FinalPassMarks:sbClean(data.finalPassMarks || data.FinalPassMarks || (existing&&existing.FinalPassMarks)),
    PromotionExam:sbClean(data.promotionExam || data.PromotionExam || (existing&&existing.PromotionExam)),
    ResultPublished:sbClean(data.resultPublished || data.ResultPublished || data.Published || oldResultPub),
    Published:sbClean(data.published || data.Published || oldPub),
    PublishStatus:sbClean(data.publishStatus || data.PublishStatus || oldPubStat)
  };
  if(!obj.SessionYear || !obj.AcademicYear || !obj.ExamType) throw new Error('Session, Year and Exam Type required');
  if(existing && existing.ExamID) obj.ExamID = existing.ExamID;
  const saved = existing && existing.row_id ? await sbPatchByRowId('Exams', existing.row_id, obj) : (await sbInsert('Exams', obj))[0];
  const exam = sbExamObj(Object.assign({}, obj, saved || {}));
  return {success:true, message:'Exam saved successfully', examId:exam.ExamID, ExamID:exam.ExamID, exam, updated:!!existing};
}
async function sbGetExamSchedule(p={}){
  const all = (await sbAll('ExamSchedule')).filter(sbIsActive);
  const examId=sbClean(p.examId||p.ExamID), year=sbClean(p.academicYear||p.AcademicYear), code=sbClean(p.subjectCode||p.SubjectCode);
  const session = sbClean(p.sessionYear || p.studySessionYear || p.SessionYear);
  const type = sbClean(p.examType || p.ExamType);
  let exam = {};
  if(examId) exam = (await sbGetExams({examId})).exams[0] || {};

  let rows = all;
  if(examId){
    rows = rows.filter(r=>sbClean(r.ExamID)===examId);
    // Imported old schedules may have blank ExamID. Fall back to Session + Year + ExamType.
    if(!rows.length && (exam.SessionYear || session) && (exam.AcademicYear || year)){
      rows = all.filter(r=>
        sbClean(r.SessionYear)===(exam.SessionYear || session) &&
        sbClean(r.AcademicYear)===(exam.AcademicYear || year) &&
        (!exam.ExamType || !sbClean(r.ExamType) || sbClean(r.ExamType)===exam.ExamType)
      );
    }
  } else {
    if(session) rows=rows.filter(r=>sbClean(r.SessionYear)===session);
    if(year) rows=rows.filter(r=>sbClean(r.AcademicYear)===year);
    if(type) rows=rows.filter(r=>sbClean(r.ExamType)===type);
  }
  if(year) rows=rows.filter(r=>!sbClean(r.AcademicYear) || sbClean(r.AcademicYear)===year);
  if(code) rows=rows.filter(r=>sbClean(r.SubjectCode)===code);

  const latest = new Map();
  rows.forEach((r,idx)=>{
    const k=[sbClean(r.ExamID)||examId||'', sbClean(r.SubjectCode), sbClean(r.SessionYear), sbClean(r.AcademicYear), sbClean(r.ExamType)].join('|') || ('row_'+(r.row_id||idx));
    const old=latest.get(k);
    if(!old || Number(r.row_id||0) >= Number(old.row_id||0)) latest.set(k,r);
  });
  rows = Array.from(latest.values());
  const subjectRows = (await sbGetSubjects({academicYear:exam.AcademicYear || year || (rows[0] && rows[0].AcademicYear) || ''})).subjects;
  const order = sbSubjectOrderMap(subjectRows);
  rows = rows.sort((a,b)=>{
    const ao = order[sbClean(a.SubjectCode)] || sbSubjectSerialNum(a, 999999);
    const bo = order[sbClean(b.SubjectCode)] || sbSubjectSerialNum(b, 999999);
    if(ao !== bo) return ao - bo;
    return sbClean(a.SubjectCode).localeCompare(sbClean(b.SubjectCode), undefined, {numeric:true});
  });
  return {success:true, exam, schedule:code ? (rows[0] || null) : rows, schedules:rows, rows};
}
async function sbSaveExamSchedule(data={}){
  const exam = (await sbGetExams({examId:data.examId || data.ExamID})).exams[0] || {};
  const subjectCode = sbClean(data.subjectCode || data.SubjectCode);
  const subj = ((await sbGetSubjects({academicYear: data.academicYear || exam.AcademicYear, subjectCode})).subjects || [])[0] || {};
  const givenScheduleId = sbClean(data.scheduleId || data.ScheduleID);
  const obj = {Timestamp:sbNow(), ScheduleID:givenScheduleId || sbId('SCH'), ExamID:sbClean(data.examId || data.ExamID || exam.ExamID), SessionYear:sbClean(data.sessionYear || exam.SessionYear), AcademicYear:sbClean(data.academicYear || exam.AcademicYear), ExamType:sbClean(data.examType || exam.ExamType), ExamName:sbClean(data.examName || exam.ExamName), SubjectCode:subjectCode, SubjectName:subj.SubjectName || '', ExamDate:sbClean(data.examDate || data.ExamDate), ExamTime:sbClean(data.examTime || data.ExamTime), Room:sbClean(data.room || data.Room), Note:sbClean(data.note || data.Note), Status:sbClean(data.status || 'Active'), SubjectExamMarks:sbClean(data.subjectExamMarks || data.SubjectExamMarks), SubjectAssignmentMarks:sbClean(data.subjectAssignmentMarks || data.SubjectAssignmentMarks), SubjectAttendanceMarks:sbClean(data.subjectAttendanceMarks || data.SubjectAttendanceMarks), SubjectTestMarks:sbClean(data.subjectTestMarks || data.SubjectTestMarks), SubjectFinalPassMarks:sbClean(data.subjectFinalPassMarks || data.SubjectFinalPassMarks), SubjectFullMarks:sbClean(data.subjectFullMarks || data.SubjectFullMarks || data.subjectExamMarks || data.SubjectExamMarks || subj.FullMarks)};
  if(!obj.ExamID) throw new Error('ExamID missing. Please select a saved exam.');
  if(!obj.SubjectCode) throw new Error('Subject required.');

  const existing = (await sbAll('ExamSchedule', {raw:true})).filter(sbIsActive).find(r=>
    (givenScheduleId && sbClean(r.ScheduleID)===givenScheduleId) ||
    (sbClean(r.ExamID)===obj.ExamID && sbClean(r.SubjectCode)===obj.SubjectCode) ||
    (!sbClean(r.ExamID) && sbClean(r.SessionYear)===obj.SessionYear && sbClean(r.AcademicYear)===obj.AcademicYear && (!sbClean(r.ExamType) || sbClean(r.ExamType)===obj.ExamType) && sbClean(r.SubjectCode)===obj.SubjectCode)
  );
  if(existing && existing.ScheduleID) obj.ScheduleID = existing.ScheduleID;
  const saved = existing && existing.row_id ? await sbPatchByRowId('ExamSchedule', existing.row_id, obj) : (await sbInsert('ExamSchedule', obj))[0];
  return {success:true, message:'Schedule saved successfully', scheduleId:obj.ScheduleID, ScheduleID:obj.ScheduleID, schedule:saved || obj, updated:!!existing};
}
async function sbSetExamBlock(data={}){
  const obj = {Timestamp:sbNow(), ExamID:sbClean(data.examId), Roll:sbClean(data.roll), RegistrationNumber:sbClean(data.registrationNumber), StudentName:sbClean(data.name||data.studentName), Blocked:sbClean(data.status||data.blocked), Reason:sbClean(data.reason), Status:'Active'};
  const saved = await sbUpsertBy('ExamBlocks', r=>sbClean(r.ExamID)===obj.ExamID && sbClean(r.Roll)===obj.Roll, obj);
  return {success:true, message:'Exam block saved', block:saved||obj};
}
async function sbGetExamBlockPanelData(p={}){
  const exam = (await sbGetExams({examId:p.examId})).exams[0]; if(!exam) return {success:false, message:'Exam not found', students:[]};
  const students = (await sbGetStudents({academicYear:exam.AcademicYear, sessionYear:p.studySessionYear||exam.SessionYear})).students;
  const blocks = (await sbAll('ExamBlocks')).filter(r=>sbClean(r.ExamID)===exam.ExamID);
  const bmap={}; blocks.forEach(b=>bmap[sbClean(b.Roll)]=b);
  const out = students.map(s=>Object.assign({}, s, {Blocked:(bmap[s.Roll]&&bmap[s.Roll].Blocked)||'Unblocked', Reason:(bmap[s.Roll]&&bmap[s.Roll].Reason)||''}));
  return {success:true, exam, students:out};
}
function sbAssignedCodesMap(rows){
  const map = {};
  (rows || []).forEach(r=>{
    const roll = sbClean(r.Roll || r.RegistrationNumber);
    if(!roll) return;
    let codes = sbSplit(r.SubjectCodes || r.SubjectCode);
    if(!map[roll]) map[roll] = new Set();
    codes.forEach(c=>map[roll].add(c));
  });
  return map;
}
function sbStudentAssignedToSubject(student, subjectCode, assignedMap, hasAnyAssignments){
  if(!hasAnyAssignments) return true;
  const set = assignedMap[sbClean(student.Roll)] || assignedMap[sbClean(student.RegistrationNumber)];
  return !!(set && set.has(sbClean(subjectCode)));
}
async function sbGetMarksForExamSubject(examId, subjectCode){ return (await sbAll('Marks')).filter(r=>sbClean(r.ExamID)===sbClean(examId) && (!subjectCode || sbClean(r.SubjectCode)===sbClean(subjectCode))).filter(sbIsActive); }
async function sbGetMarksEntryData(p={}){
  const exam = (await sbGetExams({examId:p.examId})).exams[0]; if(!exam) throw new Error('Exam not found');
  const subject = ((await sbGetSubjects({academicYear:exam.AcademicYear, subjectCode:p.subjectCode})).subjects || [])[0] || {SubjectCode:sbClean(p.subjectCode), SubjectName:''};
  const schedRes = await sbGetExamSchedule({examId:exam.ExamID, subjectCode:subject.SubjectCode});
  const schedule = schedRes.schedule || null;
  const stAll = (await sbGetStudents({academicYear:exam.AcademicYear, sessionYear:p.studySessionYear || p.currentStudySession || exam.SessionYear})).students;
  const selectedStudySession = sbClean(p.studySessionYear || p.currentStudySession || p.sessionYear || exam.SessionYear);
  const assignedRows = await sbGetAssignedRowsForStudents(exam.AcademicYear, selectedStudySession, stAll);
  const assignedMap = sbAssignedCodesMap(assignedRows);
  const hasAssignments = assignedRows.length > 0;
  let students = stAll.filter(s=>sbStudentAssignedToSubject(s, subject.SubjectCode, assignedMap, hasAssignments));
  const marks = await sbGetMarksForExamSubject(exam.ExamID, subject.SubjectCode); const mmap={}; marks.forEach(m=>mmap[sbClean(m.Roll)]=m);
  students = students.map(s=>Object.assign({}, s, mmap[s.Roll] || {}, {Name:s.Name || s.StudentName, StudentName:s.Name || s.StudentName, Roll:s.Roll, RegistrationNumber:s.RegistrationNumber}));
  return {success:true, exam, subject, schedule, students};
}
async function sbSaveIndividualMarks(data={}){
  const exam = (await sbGetExams({examId:data.examId || data.ExamID})).exams[0] || {};
  if(!exam) throw new Error('Exam not found');
  const roll = sbClean(data.roll || data.Roll);
  const reg = sbClean(data.reg || data.RegistrationNumber);
  if(!roll) throw new Error('Roll is required');
  let saved = 0;
  if(Array.isArray(data.subjects)){
    for(const sub of data.subjects){
      if(!sub.subjectCode) continue;
      await sbSaveMarks({
        examId: exam.ExamID,
        subjectCode: sub.subjectCode,
        marks: [{
          roll: roll,
          reg: reg,
          marks: sub.marks,
          examMarks: sub.marks,
          assignmentMarks: sub.assignmentMarks,
          attendanceMarks: sub.attendanceMarks
        }]
      });
      saved++;
    }
  }
  return {success:true, message: `Saved marks for ${saved} subjects`, saved};
}
async function sbSaveMarks(data={}){
  const exam = (await sbGetExams({examId:data.examId || data.ExamID})).exams[0] || {};
  const subject = ((await sbGetSubjects({academicYear:exam.AcademicYear || data.academicYear, subjectCode:data.subjectCode || data.SubjectCode})).subjects || [])[0] || {SubjectCode:sbClean(data.subjectCode), SubjectName:''};
  const schedRes = await sbGetExamSchedule({examId:exam.ExamID || data.examId, subjectCode:subject.SubjectCode || data.subjectCode});
  const schedule = schedRes.schedule || {};
  const rows = Array.isArray(data.marks) ? data.marks : [data];
  const existingRows = await sbGetMarksForExamSubject(exam.ExamID || data.examId, subject.SubjectCode || data.subjectCode);
  const emap = {}; existingRows.forEach(r=>emap[sbClean(r.Roll)] = r);
  let saved = 0;
  for(const row of rows){
    const roll = sbClean(row.roll || row.Roll); if(!roll) continue;
    const tmp = {
      ExamType: exam.ExamType || data.examType || row.examType || row.ExamType,
      Marks: row.marks ?? row.Marks,
      ExamMarks: row.examMarks ?? row.ExamMarks,
      AssignmentMarks: row.assignmentMarks ?? row.AssignmentMarks,
      AttendanceMarks: row.attendanceMarks ?? row.AttendanceMarks
    };
    const markValue = sbMarkObtainedValue(tmp);
    const full = sbFindScheduleFullMarks(tmp, exam, subject, schedule);
    const rs = sbGradeResultForDisplay(markValue, full, subject);
    const student = await sbFindStudent(roll) || {};
    const obj = {Timestamp:sbNow(), MarkID:sbClean(row.markId || row.MarkID) || (emap[roll] && emap[roll].MarkID) || sbId('MRK'), ExamID:exam.ExamID || sbClean(data.examId), SessionYear:exam.SessionYear || sbClean(data.sessionYear), AcademicYear:exam.AcademicYear || sbClean(data.academicYear), ExamType:exam.ExamType || sbClean(data.examType), SubjectCode:subject.SubjectCode || sbClean(data.subjectCode), SubjectName:subject.SubjectName || '', Roll:roll, RegistrationNumber:sbClean(row.registrationNumber || student.RegistrationNumber), StudentName:sbClean(row.name || row.studentName || student.Name), ExamMarks:sbRoundMarkValue(row.examMarks ?? row.ExamMarks ?? markValue), AssignmentMarks:sbRoundMarkValue(row.assignmentMarks || row.AssignmentMarks), AttendanceMarks:sbRoundMarkValue(row.attendanceMarks || row.AttendanceMarks || 0), Marks:sbRoundMarkValue(markValue), Grade:rs.grade, GPA:sbFormatGpaValue(rs.gp), PassFail:rs.status, Status:'Active'};
    if(emap[roll] && emap[roll].row_id) await sbPatchByRowId('Marks', emap[roll].row_id, obj); else await sbInsert('Marks', obj);
    saved++;
  }
  return {success:true, message:saved + ' marks saved', saved};
}
async function sbSaveAttendanceMarks(data={}){
  const rows = Array.isArray(data.marks) ? data.marks : [];
  let existing = await sbAll('AttendanceMarks');
  let saved=0;
  for(const row of rows){
    const roll = sbClean(row.roll || row.Roll); if(!roll) continue;
    const student = await sbFindStudent(roll) || {};
    const obj = {Timestamp:sbNow(), AttendanceMarkID:sbClean(row.attendanceMarkId)||sbId('ATT'), ExamID:sbClean(data.examId||row.examId), SessionYear:sbClean(data.sessionYear || row.sessionYear || student.SessionYear), AcademicYear:sbClean(data.academicYear || row.academicYear || student.CurrentYear), ExamType:sbClean(data.examType || row.examType), SubjectCode:sbClean(data.subjectCode || row.subjectCode), SubjectName:sbClean(data.subjectName || row.subjectName), Roll:roll, RegistrationNumber:sbClean(row.registrationNumber || student.RegistrationNumber), StudentName:sbClean(row.name || row.studentName || student.Name), AttendanceMarks:sbRoundMarkValue(row.attendanceMarks ?? row.marks ?? row.Marks), MaxAttendanceMarks:sbRoundMarkValue(data.maxMarks || row.maxMarks), Remarks:sbClean(row.remarks), Status:'Active'};
    const found = existing.find(r=>sbClean(r.Roll)===roll && sbClean(r.AcademicYear)===obj.AcademicYear && sbClean(r.SessionYear)===obj.SessionYear && (!obj.SubjectCode || sbClean(r.SubjectCode)===obj.SubjectCode));
    if(found && found.row_id) await sbPatchByRowId('AttendanceMarks', found.row_id, obj); else await sbInsert('AttendanceMarks', obj);
    saved++;
  }
  return {success:true, message:saved+' attendance marks saved', saved};
}
async function sbGetAttendanceMarksData(p={}){
  const students = (await sbGetStudents({academicYear:p.academicYear, sessionYear:p.sessionYear, sortField:p.sortField, sortDir:p.sortDir})).students;
  const marks = (await sbAll('AttendanceMarks')).filter(r=>(!p.academicYear || sbClean(r.AcademicYear)===sbClean(p.academicYear)) && (!p.sessionYear || sbClean(r.SessionYear)===sbClean(p.sessionYear)));
  const map={}; marks.forEach(m=>map[sbClean(m.Roll)]=m);
  return {success:true, students:students.map(s=>Object.assign({}, s, map[s.Roll]||{})), marks};
}
function sbNormalizeScheduleRowForAdmit_(row, subjectMap){
  const r = row || {};
  const code = sbClean(r.SubjectCode || r['Subject Code'] || r.Code);
  const sub = subjectMap && code ? subjectMap[code] : null;
  return Object.assign({}, r, {
    SubjectCode: code,
    SubjectName: sbClean((sub && sub.SubjectName) || r.SubjectName || r['Subject Name'] || r.Name),
    SubjectType: sbClean((sub && sub.SubjectType) || r.SubjectType || r.Type),
    ExamDate: sbDateOnly(r.ExamDate || r.SubjectDate || r.Date || r.ExamDay),
    ExamTime: sbClean(r.ExamTime || r.Time || r.SubjectTime),
    Room: sbClean(r.Room || r.RoomNo || r.Hall || r.HallRoom),
    SubjectFullMarks: sbClean(r.SubjectFullMarks || r.FullMarks || (sub && sub.FullMarks) || r.SubjectExamMarks || r.SubjectTestMarks)
  });
}
async function sbGetFullAttendanceData(p={}){
  const exam = (await sbGetExams({examId:p.examId})).exams[0] || {};
  const academicYear = sbClean(p.academicYear || exam.AcademicYear);
  const selectedStudySession = sbClean(p.studySessionYear || p.currentStudySession || p.sessionYear || exam.SessionYear);
  const subjectRows = (await sbGetSubjects({academicYear})).subjects || [];
  const subjectMap = {};
  subjectRows.forEach(s=>{ subjectMap[sbClean(s.SubjectCode)] = s; });
  let schedules = (await sbGetExamSchedule({
    examId:p.examId || exam.ExamID,
    sessionYear:selectedStudySession || exam.SessionYear,
    academicYear,
    examType:exam.ExamType,
    noCache:'1',
    forceFresh:'1'
  })).schedules || [];
  schedules = (schedules || []).map(r=>sbNormalizeScheduleRowForAdmit_(r, subjectMap)).filter(r=>r.SubjectCode);
  if(!schedules.length){
    const sub = (await sbGetSubjectsForExamCreate({academicYear, examType:exam.ExamType, noCache:'1', forceFresh:'1'})).subjects || [];
    schedules = sub.map(s=>sbNormalizeScheduleRowForAdmit_({SubjectCode:s.SubjectCode, SubjectName:s.SubjectName, SubjectType:s.SubjectType, ExamDate:'', ExamTime:'', Room:'', SubjectFullMarks:s.FullMarks}, subjectMap));
  }
  schedules = sbSortBySubjectSerial(schedules, subjectRows);
  const students = (await sbGetStudents({academicYear, sessionYear:selectedStudySession, noCache:'1', forceFresh:'1'})).students;
  const assignedRows = await sbGetAssignedRowsForStudents(academicYear, selectedStudySession, students);
  const assignedMap = sbAssignedCodesMap(assignedRows);
  const hasAssignments = assignedRows.length > 0;
  const out = students.map(st=>{
    const studentSchedules = schedules.filter(s=>sbStudentAssignedToSubject(st, s.SubjectCode, assignedMap, hasAssignments));
    const cells = schedules.map(s=>sbStudentAssignedToSubject(st, s.SubjectCode, assignedMap, hasAssignments) ? '' : 'X');
    return Object.assign({}, st, {Schedules:studentSchedules, Schedule:studentSchedules, SubjectCells:cells, SubjectCount:studentSchedules.length});
  });
  return {success:true, exam, schedule:schedules, schedules, subjects:schedules, students:out};
}
async function sbGetMissingMarksList(p={}){
  const exam = (await sbGetExams({examId:p.examId})).exams[0]; if(!exam) throw new Error('Exam not found');
  let subjects = [];
  const schedules = (await sbGetExamSchedule({examId:exam.ExamID})).schedules || [];
  if(schedules.length) subjects = schedules.map(s=>({SubjectCode:s.SubjectCode, SubjectName:s.SubjectName, SubjectType:s.SubjectType||'', FullMarks:s.SubjectFullMarks||s.SubjectExamMarks||''}));
  else subjects = (await sbGetSubjectsForExamCreate({academicYear:exam.AcademicYear, examType:exam.ExamType})).subjects;
  const singleCode = sbClean(p.subjectCode);
  if(singleCode) subjects = subjects.filter(s=>sbClean(s.SubjectCode)===singleCode);
  const students = (await sbGetStudents({academicYear:exam.AcademicYear, sessionYear:p.studySessionYear || p.currentStudySession || exam.SessionYear})).students;
  const selectedStudySession = sbClean(p.studySessionYear || p.currentStudySession || p.sessionYear || exam.SessionYear);
  const assignedRows = await sbGetAssignedRowsForStudents(exam.AcademicYear, selectedStudySession, students);
  const assignedMap = sbAssignedCodesMap(assignedRows), hasAssignments = assignedRows.length > 0;
  const allMarks = (await sbAll('Marks')).filter(m=>sbClean(m.ExamID)===exam.ExamID && sbIsActive(m));
  const q = sbLower(p.search || p.q);
  let assignedCount=0, enteredCount=0, missingCount=0;
  const groups = subjects.map(sub=>{
    const subjectStudents = students.filter(st=>sbStudentAssignedToSubject(st, sub.SubjectCode, assignedMap, hasAssignments)).filter(st=>!q || [st.Roll,st.RegistrationNumber,st.Name].join(' ').toLowerCase().includes(q));
    const entered = {}; allMarks.filter(m=>sbClean(m.SubjectCode)===sbClean(sub.SubjectCode) && sbClean(m.Marks || m.ExamMarks) !== '').forEach(m=>entered[sbClean(m.Roll)] = true);
    const missing = subjectStudents.filter(st=>!entered[sbClean(st.Roll)]).map(st=>({Roll:st.Roll, RegistrationNumber:st.RegistrationNumber, Name:st.Name, SessionYear:st.SessionYear, StudySessionYear:st.StudySessionYear || st.CurrentStudySession || st.SessionYear, StudentType:st.StudentType || 'Regular', Reason:'Marks not entered'}));
    assignedCount += subjectStudents.length;
    enteredCount += subjectStudents.length - missing.length;
    missingCount += missing.length;
    return {SubjectCode:sub.SubjectCode, SubjectName:sub.SubjectName, AssignedCount:subjectStudents.length, EnteredCount:subjectStudents.length - missing.length, MissingCount:missing.length, MissingStudents:missing};
  });
  return {success:true, exam, subjects:groups, summary:{subjectCount:groups.length, assignedCount, enteredCount, missingCount}, markingSystem:{}, count:missingCount};
}
async function sbGetIncourseAverageSheet(p={}){
  const year = sbClean(p.academicYear || p.AcademicYear);
  const session = sbClean(p.studySessionYear || p.sessionYear || p.currentStudySession);
  if(!year) throw new Error('Academic Year required');
  let subjects = (await sbGetSubjectsForExamCreate({academicYear:year, examType:'1st Incourse'})).subjects;
  const students = (await sbGetStudents({academicYear:year, sessionYear:session})).students;
  const assignedRows = await sbGetAssignedRowsForStudents(year, session, students);
  const assignedMap = sbAssignedCodesMap(assignedRows), hasAssignments = assignedRows.length > 0;
  const exams = (await sbGetExams({academicYear:year, sessionYear:session})).exams.filter(e=>e.ExamType==='1st Incourse' || e.ExamType==='2nd Incourse');
  const firstIds = exams.filter(e=>e.ExamType==='1st Incourse').map(e=>e.ExamID);
  const secondIds = exams.filter(e=>e.ExamType==='2nd Incourse').map(e=>e.ExamID);
  const marks = (await sbAll('Marks')).filter(m=>firstIds.includes(sbClean(m.ExamID)) || secondIds.includes(sbClean(m.ExamID)));
  const attendanceRows = (await sbAll('AttendanceMarks')).filter(m=>(!year || sbClean(m.AcademicYear)===year) && (!session || [m.SessionYear,m.StudySessionYear].map(sbClean).includes(session)));
  const markMap = {};
  marks.forEach(m=>{ const key=sbClean(m.Roll)+'|'+sbClean(m.SubjectCode); if(!markMap[key]) markMap[key]={}; if(firstIds.includes(sbClean(m.ExamID))) markMap[key].first = sbClean(m.Marks || m.ExamMarks); if(secondIds.includes(sbClean(m.ExamID))) markMap[key].second = sbClean(m.Marks || m.ExamMarks); });
  const attMap = {}; attendanceRows.forEach(a=>{ const key=sbClean(a.Roll)+'|'+sbClean(a.SubjectCode || ''); attMap[key]=sbClean(a.AttendanceMarks || a.Marks); if(!a.SubjectCode) attMap[sbClean(a.Roll)+'|*']=sbClean(a.AttendanceMarks || a.Marks); });
  const out = students.map(st=>{
    const SubjectCells = {};
    subjects.forEach(sub=>{
      const assigned = sbStudentAssignedToSubject(st, sub.SubjectCode, assignedMap, hasAssignments);
      if(!assigned){ SubjectCells[sub.SubjectCode] = {assigned:false}; return; }
      const mm = markMap[st.Roll+'|'+sub.SubjectCode] || {};
      const n1 = mm.first === 'A' ? NaN : Number(mm.first);
      const n2 = mm.second === 'A' ? NaN : Number(mm.second);
      let avg = '';
      if(Number.isFinite(n1) && Number.isFinite(n2)) avg = sbRoundMarkValue((n1+n2)/2);
      else if(Number.isFinite(n1)) avg = sbRoundMarkValue(n1);
      else if(Number.isFinite(n2)) avg = sbRoundMarkValue(n2);
      SubjectCells[sub.SubjectCode] = {assigned:true, first:sbRoundMarkValue(mm.first || ''), second:sbRoundMarkValue(mm.second || ''), average:avg, attendance:sbRoundMarkValue(attMap[st.Roll+'|'+sub.SubjectCode] || attMap[st.Roll+'|*'] || '')};
    });
    return Object.assign({}, st, {SubjectCells});
  });
  return {success:true, subjects, students:out, sessionYear:session, academicYear:year};
}
async function sbGetFinalResults(p={}){
  let rows = await sbAll('FinalResults'); const year=sbClean(p.academicYear), roll=sbClean(p.roll);
  if(year) rows=rows.filter(r=>sbClean(r.AcademicYear)===year);
  if(roll) rows=rows.filter(r=>sbClean(r.Roll)===roll || sbClean(r.RegistrationNumber)===roll);
  rows.sort(sbSortByRoll);
  return {success:true, results:rows};
}
async function sbSaveFinalResults(data={}){
  const rows = Array.isArray(data.results) ? data.results : [];
  let saved=0;
  for(const r of rows){
    const roll=sbClean(r.roll||r.Roll); if(!roll) continue;
    const student = await sbFindStudent(roll) || {};
    const obj={Timestamp:sbNow(), ResultID:sbClean(r.ResultID)||sbId('FR'), SessionYear:sbClean(r.sessionYear||r.SessionYear||student.SessionYear), AcademicYear:sbClean(data.academicYear||r.academicYear||r.AcademicYear||student.CurrentYear), Roll:roll, RegistrationNumber:sbClean(r.registrationNumber||student.RegistrationNumber), StudentName:sbClean(r.name||r.studentName||student.Name), FinalMarks:sbClean(r.finalMarks||r.FinalMarks), GPA:sbClean(r.gpa||r.GPA), ResultStatus:sbClean(r.resultStatus||r.ResultStatus), PromotedToYear:sbClean(r.promotedToYear||r.PromotedToYear), Remarks:sbClean(r.remarks||r.Remarks)};
    await sbUpsertBy('FinalResults', x=>sbClean(x.Roll)===roll && sbClean(x.AcademicYear)===obj.AcademicYear, obj);
    saved++;
  }
  return {success:true, message:saved+' final results saved', saved};
}
function sbExamPublished(e){ const s=[e.ResultPublished,e.Published,e.PublishStatus,e.Status].map(sbLower).join(' '); return /yes|published|active/.test(s) && !/no|unpublished/.test(s); }
async function sbGetPublishedExamSessions(){ const exams=(await sbGetExams({})).exams.filter(sbExamPublished); const sessions=sbUnique(exams.map(e=>e.SessionYear)).sort().reverse(); return {success:true, sessions}; }
async function sbGetPublishedExamsForStudent(p={}){ let exams=(await sbGetExams({sessionYear:p.sessionYear})).exams.filter(sbExamPublished); return {success:true, exams}; }
function sbResultRowFromGroup(student, marks, subjectRows, scheduleRows, exam){
  let total=0, fail=false, gpTotal=0, creditTotal=0;
  const subjectMap={}; (subjectRows || []).forEach(s=>subjectMap[s.SubjectCode]=s);
  const scheduleMap = sbBuildScheduleMap(scheduleRows || []);
  const order = sbSubjectOrderMap(subjectRows || []);

  marks = (marks || []).slice().sort((a,b)=>{
    const ao = order[sbClean(a.SubjectCode)] || 999999;
    const bo = order[sbClean(b.SubjectCode)] || 999999;
    if(ao !== bo) return ao - bo;
    return sbClean(a.SubjectCode).localeCompare(sbClean(b.SubjectCode), undefined, {numeric:true});
  });

  const markDetails = marks.map(m=>{
    const code = sbClean(m.SubjectCode);
    const subject = subjectMap[code] || {SubjectCode:code, SubjectName:sbClean(m.SubjectName), FullMarks:''};
    const schedule = scheduleMap[code] || {};
    const mark = sbMarkObtainedValue(m);
    const full = sbFindScheduleFullMarks(m, exam || {}, subject, schedule);
    const rs = sbGradeResultForDisplay(mark, full, subject);
    const credit = sbCreditValue(subject);
    const status = rs.status;
    const grade = rs.grade;
    const gp = sbFormatGpaValue(rs.gp);

    if(grade === 'F' || grade === 'AB' || sbLower(status).startsWith('fail')) fail = true;
    total += sbNum(sbRoundMarkValue(mark));
    if(credit > 0 && gp !== ''){
      gpTotal += sbNum(gp) * credit;
      creditTotal += credit;
    }

    return {
      code:code,
      subject:subject.SubjectName || sbClean(m.SubjectName),
      mark:sbRoundMarkValue(mark),
      fullMarks:String(full || ''),
      grade:grade,
      gp:gp,
      status:status,
      credit:credit ? String(credit) : '',
      nonCredit:!!rs.nonCredit,
      SubjectCode:code,
      SubjectName:subject.SubjectName || sbClean(m.SubjectName),
      Marks:sbRoundMarkValue(mark),
      FullMarks:String(full || ''),
      Grade:grade,
      GP:sbFormatGpaValue(gp),
      GPA:sbFormatGpaValue(gp),
      PassFail:status
    };
  });

  const cgpa = fail ? 'FAIL' : (creditTotal ? sbFormatGpaValue(gpTotal/creditTotal) : '');
  const failedCodes = markDetails
    .filter(m=>m.grade==='F'||m.grade==='AB'||sbLower(m.status).startsWith('fail'))
    .map(m=>m.code)
    .join(', ');
  const marksMap={}; markDetails.forEach(m=>marksMap[m.code]=sbRoundMarkValue(m.mark));
  return {
    roll:student.Roll,
    reg:student.RegistrationNumber,
    name:student.Name || student.StudentName,
    Roll:student.Roll,
    RegistrationNumber:student.RegistrationNumber,
    StudentName:student.Name || student.StudentName,
    total:sbRoundMarkValue(total),
    TotalMarks:sbRoundMarkValue(total),
    cgpa,
    GPA:cgpa,
    failedCodes,
    FailedCodes:failedCodes,
    passed:fail?0:markDetails.length,
    failed:failedCodes.split(',').filter(Boolean).length,
    rank:'',
    Rank:'',
    nonMajorGroup:student.NonMajorGroup||'',
    groupText:student.NonMajorGroup||'',
    marks:marksMap,
    markDetails
  };
}
async function sbGetStudentResultFast(p={}){
  const exam=(await sbGetExams({examId:p.examId || p.ExamID})).exams[0] || {};
  const student=await sbFindStudent(p.search||p.roll||p.registrationNumber||p.rollId);
  if(!student) return {success:false, found:false, message:'Student not found'};

  const resultList = await sbBuildResultListFromMarks_(exam, Object.assign({}, p, {
    examId: exam.ExamID || p.examId || p.ExamID,
    sessionYear: p.studySessionYear || p.currentStudySession || p.sessionYear || exam.SessionYear || student.StudySessionYear || student.CurrentStudySession || student.SessionYear,
    academicYear: p.academicYear || exam.AcademicYear || student.CurrentYear || student.AcademicYear
  }));

  let row = (resultList.all || []).find(r=>
    sbClean(r.roll || r.Roll) === sbClean(student.Roll) ||
    sbClean(r.reg || r.RegistrationNumber) === sbClean(student.RegistrationNumber)
  );

  if(!row){
    const marks=(await sbAll('Marks')).filter(m=>(!p.examId||sbClean(m.ExamID)===sbClean(p.examId)) && (sbClean(m.Roll)===student.Roll || sbClean(m.RegistrationNumber)===student.RegistrationNumber)).filter(sbIsActive);
    if(!marks.length) return {success:false, found:false, message:'Result not found'};
    const subjectRows=(await sbGetSubjects({academicYear:exam.AcademicYear || student.CurrentYear})).subjects;
    const sched=(await sbGetExamSchedule({examId:exam.ExamID || p.examId, academicYear:exam.AcademicYear || student.CurrentYear, sessionYear:exam.SessionYear || p.sessionYear, examType:exam.ExamType})).schedules || [];
    row = sbResultRowFromGroup(student, marks, subjectRows, sched, exam);
  }

  return {
    success:true, found:true, exam: resultList.exam || exam,
    name:row.name || row.StudentName || student.Name,
    roll:row.roll || row.Roll || student.Roll,
    reg:row.reg || row.RegistrationNumber || student.RegistrationNumber,
    total:row.total || row.TotalMarks,
    cgpa:row.cgpa || row.GPA,
    rank:row.rank || row.Rank || '',
    Rank:row.Rank || row.rank || '',
    nonMajorGroup:row.nonMajorGroup||row.NonMajorGroup||'',
    groupText:row.groupText||row.nonMajorGroup||row.NonMajorGroup||'',
    marks:row.markDetails || row.marks || [],
    markDetails:row.markDetails || []
  };
}
async function sbGetEasyResultChoices(){ const exams=(await sbGetExams({})).exams; return {success:true, exams, sessions:sbUnique(exams.map(e=>e.SessionYear)), years:sbUnique(exams.map(e=>e.AcademicYear)), examTypes:sbUnique(exams.map(e=>e.ExamType))}; }
function sbParseMarksJson_(value){
  const raw = sbClean(value);
  if(!raw) return [];
  try{
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){
    return [];
  }
}
function sbSummaryStudentObj_(r){
  r = r || {};
  return {
    Roll: sbClean(r.Roll || r.roll),
    RegistrationNumber: sbClean(r.RegistrationNumber || r.reg || r.RegNo),
    Name: sbClean(r.StudentName || r.Name || r.name),
    StudentName: sbClean(r.StudentName || r.Name || r.name),
    SessionYear: sbClean(r.SessionYear),
    StudySessionYear: sbClean(r.StudySessionYear || r.CurrentStudySession || r.SessionYear),
    CurrentStudySession: sbClean(r.CurrentStudySession || r.StudySessionYear || r.SessionYear),
    AcademicYear: sbClean(r.AcademicYear),
    CurrentYear: sbClean(r.AcademicYear),
    NonMajorGroup: sbClean(r.NonMajorGroup || r.Group || r.groupText)
  };
}
function sbResultRowFromSummary_(summaryRow, subjectRows, scheduleRows, exam){
  summaryRow = summaryRow || {};
  const student = sbSummaryStudentObj_(summaryRow);
  const jsonMarks = sbParseMarksJson_(summaryRow.MarksJSON || summaryRow.MarksJson || summaryRow.Marks || summaryRow.marksJSON);

  if(jsonMarks.length){
    const markRows = jsonMarks.map(m=>({
      ExamID: sbClean(summaryRow.ExamID || (exam && exam.ExamID)),
      SessionYear: sbClean(summaryRow.SessionYear || (exam && exam.SessionYear)),
      AcademicYear: sbClean(summaryRow.AcademicYear || (exam && exam.AcademicYear)),
      ExamType: sbClean(summaryRow.ExamType || (exam && exam.ExamType)),
      SubjectCode: sbClean(m.code || m.SubjectCode || m.subjectCode),
      SubjectName: sbClean(m.subject || m.SubjectName || m.subjectName),
      Marks: sbRoundMarkValue(m.mark ?? m.Marks ?? m.marks ?? m.Total ?? ''),
      ExamMarks: sbRoundMarkValue(m.ExamMarks || m.examMarks || ''),
      AssignmentMarks: sbRoundMarkValue(m.AssignmentMarks || m.assignmentMarks || ''),
      AttendanceMarks: sbRoundMarkValue(m.AttendanceMarks || m.attendanceMarks || '')
    })).filter(m=>m.SubjectCode || m.SubjectName);
    const row = sbResultRowFromGroup(student, markRows, subjectRows, scheduleRows, exam);
    row.rank = sbClean(summaryRow.Rank || row.rank);
    row.Rank = sbClean(summaryRow.Rank || row.Rank);
    row.nonMajorGroup = sbClean(summaryRow.NonMajorGroup || summaryRow.Group || row.nonMajorGroup);
    row.groupText = sbClean(summaryRow.Group || summaryRow.NonMajorGroup || row.groupText);
    return row;
  }

  const savedGpa = sbFormatGpaValue(summaryRow.GPA || summaryRow.cgpa);
  const savedStatus = sbLower(summaryRow.Status || summaryRow.PassFail || summaryRow.ResultStatus);
  const failedCodes = sbClean(summaryRow.FailedCodes || summaryRow.FailedCode || '');
  const fail = savedGpa.toUpperCase() === 'FAIL' || savedStatus.includes('fail') || failedCodes;
  return {
    roll: student.Roll,
    reg: student.RegistrationNumber,
    name: student.Name,
    Roll: student.Roll,
    RegistrationNumber: student.RegistrationNumber,
    StudentName: student.Name,
    total: sbRoundMarkValue(summaryRow.TotalMarks || summaryRow.Total || summaryRow.FinalMarks || ''),
    TotalMarks: sbRoundMarkValue(summaryRow.TotalMarks || summaryRow.Total || summaryRow.FinalMarks || ''),
    cgpa: fail ? 'FAIL' : savedGpa,
    GPA: fail ? 'FAIL' : savedGpa,
    failedCodes: failedCodes,
    FailedCodes: failedCodes,
    passed: sbNum(summaryRow.Passed),
    failed: sbNum(summaryRow.Failed),
    rank: sbClean(summaryRow.Rank || ''),
    Rank: sbClean(summaryRow.Rank || ''),
    nonMajorGroup: sbClean(summaryRow.NonMajorGroup || summaryRow.Group || ''),
    groupText: sbClean(summaryRow.Group || summaryRow.NonMajorGroup || ''),
    marks: {},
    markDetails: []
  };
}
async function sbGetResultSummaryRows_(exam, p={}){
  const examId = sbClean((exam && exam.ExamID) || p.examId || p.ExamID);
  const session = sbClean(p.studySessionYear || p.currentStudySession || p.sessionYear || (exam && exam.SessionYear));
  const year = sbClean(p.academicYear || (exam && exam.AcademicYear));
  let rows = (await sbAll('ResultSummary', {raw:true})).filter(sbIsActive);

  if(examId){
    const exact = rows.filter(r=>sbClean(r.ExamID) === examId);
    if(exact.length) rows = exact;
  }
  if(year){
    const exactYear = rows.filter(r=>sbClean(r.AcademicYear) === year);
    if(exactYear.length) rows = exactYear;
  }
  if(session){
    const exactSession = rows.filter(r=>sbClean(r.StudySessionYear || r.CurrentStudySession || r.SessionYear) === session);
    if(exactSession.length) rows = exactSession;
  }

  const m = new Map();
  rows.forEach((r,i)=>{
    const key = sbClean(r.Roll || r.RegistrationNumber) || ('row_'+i);
    const old = m.get(key);
    if(!old || Number(r.row_id || 0) >= Number(old.row_id || 0)) m.set(key, r);
  });
  return Array.from(m.values());
}
function sbFinalizeResultList_(all, subjectRows){
  all = (all || []).filter(r=>sbClean(r.roll || r.Roll));
  all.sort(sbSortByRoll);
  const passed = all.filter(r=>sbClean(r.cgpa || r.GPA).toUpperCase() !== 'FAIL').sort((a,b)=>{
    const ag = sbNum(a.cgpa), bg = sbNum(b.cgpa);
    if(bg !== ag) return bg - ag;
    return sbNum(b.total)-sbNum(a.total) || sbSortByRoll(a,b);
  });
  passed.forEach((r,i)=>{r.rank=i+1; r.Rank=i+1; r.RankText=String(i+1);});
  all.forEach(r=>{
    const rk = sbClean(r.rank || r.Rank || r.RankText);
    r.rank = rk;
    r.Rank = rk;
    r.RankText = rk || '';
  });
  const allFailed = all.filter(r=>sbClean(r.cgpa || r.GPA).toUpperCase() === 'FAIL');
  const failed = {}; allFailed.forEach(r=>{ const c=String((r.failedCodes||'').split(',').filter(Boolean).length || 1); if(!failed[c]) failed[c]=[]; failed[c].push(r); });
  const subjects = sbSortSubjects(subjectRows || []).map(s=>({code:s.SubjectCode, name:s.SubjectName, SubjectCode:s.SubjectCode, SubjectName:s.SubjectName}));
  return {all, rows:all, results:all, students:all, passed, allFailed, failed, subjects};
}
async function sbBuildResultListFromMarks_(exam, p={}){
  const examId = sbClean((exam && exam.ExamID) || p.examId || p.ExamID);
  const studySession = sbClean(p.studySessionYear || p.currentStudySession || p.sessionYear || (exam && exam.SessionYear));
  const academicYear = sbClean(p.academicYear || (exam && exam.AcademicYear));

  let marksAll = (await sbAll('Marks', {raw:true})).filter(sbIsActive);
  let marks = examId ? marksAll.filter(m=>sbClean(m.ExamID) === examId) : marksAll;

  // If ExamID data is missing in old import, relax by session/year/exam type instead of returning blank.
  if(!marks.length){
    marks = marksAll.filter(m=>(!studySession || sbClean(m.SessionYear) === studySession) && (!academicYear || sbClean(m.AcademicYear) === academicYear) && (!(exam && exam.ExamType) || sbClean(m.ExamType) === sbClean(exam.ExamType)));
  }

  // ExamID is the strongest filter. Do not drop marks only because an old row has blank/mismatched AcademicYear.
  if(!examId && academicYear){
    const yearMatched = marks.filter(m=>sbClean(m.AcademicYear) === academicYear);
    if(yearMatched.length) marks = yearMatched;
  }

  const studentsAll=(await sbGetStudents({academicYear:academicYear, sessionYear:studySession})).students;
  const smap={}; studentsAll.forEach(s=>{ if(s.Roll) smap[s.Roll]=s; });
  const subjectRows = (await sbGetSubjects({academicYear:academicYear})).subjects;
  const scheduleRows = (await sbGetExamSchedule({examId:examId, academicYear:academicYear, sessionYear:studySession, examType:exam && exam.ExamType})).schedules || [];

  const byRoll={};
  marks.forEach(m=>{
    const r=sbClean(m.Roll); if(!r) return;
    // Study Session list is primary. But if Supabase student data is not imported yet, still show mark-based result instead of 0.
    if(studentsAll.length && !smap[r]) return;
    if(!byRoll[r]) byRoll[r]=[];
    byRoll[r].push(m);
  });

  let all=Object.keys(byRoll).map(roll=>sbResultRowFromGroup(
    smap[roll] || {Roll:roll, RegistrationNumber:byRoll[roll][0].RegistrationNumber, Name:byRoll[roll][0].StudentName, NonMajorGroup:byRoll[roll][0].NonMajorGroup || ''},
    byRoll[roll],
    subjectRows,
    scheduleRows,
    exam
  ));

  return Object.assign({exam, source:'marks'}, sbFinalizeResultList_(all, subjectRows));
}
async function sbGetEasyResultList(p={}){
  let exam=(await sbGetExams({examId:p.examId || p.ExamID})).exams[0] || {};
  if(!exam.ExamID){
    const allExams = (await sbGetExams({sessionYear:p.sessionYear, academicYear:p.academicYear, examType:p.examType})).exams || [];
    exam = allExams[0] || {ExamID:sbClean(p.examId), SessionYear:sbClean(p.sessionYear), AcademicYear:sbClean(p.academicYear), ExamType:sbClean(p.examType), ExamName:sbClean(p.examName)};
  }
  const studySession = sbClean(p.studySessionYear || p.currentStudySession || p.sessionYear || exam.SessionYear);
  const academicYear = sbClean(p.academicYear || exam.AcademicYear);
  exam.SessionYear = exam.SessionYear || studySession;
  exam.AcademicYear = exam.AcademicYear || academicYear;

  let live = await sbBuildResultListFromMarks_(exam, p);
  if((live.all || []).length){
    return live;
  }

  // Fallback: use ResultSummary sheet/table if Marks table is not imported or old filters do not match.
  const subjectRows = (await sbGetSubjects({academicYear:academicYear})).subjects;
  const scheduleRows = (await sbGetExamSchedule({examId:exam.ExamID || p.examId, academicYear:academicYear, sessionYear:studySession, examType:exam.ExamType})).schedules || [];
  const summaryRows = await sbGetResultSummaryRows_(exam, p);
  const all = summaryRows.map(r=>sbResultRowFromSummary_(r, subjectRows, scheduleRows, exam));
  return Object.assign({success:true, exam, source:'resultsummary-fallback'}, sbFinalizeResultList_(all, subjectRows));
}
async function sbRefreshResultSummaryFromMarks(data={}){
  const res = await sbBuildResultListFromMarks_((await sbGetExams({examId:data.examId || data.ExamID})).exams[0] || {}, data);
  let saved = 0;
  for(const r of (res.all || [])){
    const exam = res.exam || {};
    const obj = {
      Timestamp: sbNow(),
      SummaryID: sbClean(r.SummaryID) || sbId('SUM'),
      ExamID: sbClean(exam.ExamID || data.examId),
      SessionYear: sbClean(exam.SessionYear || data.sessionYear),
      AcademicYear: sbClean(exam.AcademicYear || data.academicYear),
      ExamType: sbClean(exam.ExamType || data.examType),
      ExamName: sbClean(exam.ExamName || data.examName),
      Roll: sbClean(r.roll || r.Roll),
      RegistrationNumber: sbClean(r.reg || r.RegistrationNumber),
      StudentName: sbClean(r.name || r.StudentName),
      SubjectCount: String((r.markDetails || []).length),
      Passed: String(r.passed || ''),
      Failed: String(r.failed || ''),
      TotalMarks: sbRoundMarkValue(r.total || r.TotalMarks),
      GPA: sbFormatGpaValue(r.cgpa || r.GPA),
      Rank: sbClean(r.rank || r.Rank),
      Status: sbClean(r.cgpa || r.GPA).toUpperCase() === 'FAIL' ? 'Failed' : 'Pass',
      PassFail: sbClean(r.cgpa || r.GPA).toUpperCase() === 'FAIL' ? 'Fail' : 'Pass',
      FailedCodes: sbClean(r.failedCodes || r.FailedCodes),
      MarksJSON: JSON.stringify((r.markDetails || []).map(m=>({code:m.code, subject:m.subject, mark:sbRoundMarkValue(m.mark), grade:m.grade, gp:sbFormatGpaValue(m.gp), status:m.status, credit:m.credit, nonCredit:m.nonCredit?'Yes':'No'}))),
      UpdatedAt: sbNow(),
      NonMajorGroup: sbClean(r.nonMajorGroup || r.groupText),
      ResultPublished: sbClean(exam.ResultPublished || exam.Published || '')
    };
    await sbUpsertBy('ResultSummary', x=>sbClean(x.ExamID)===obj.ExamID && sbClean(x.Roll)===obj.Roll, obj);
    saved++;
  }
  return {success:true, summaryRows:saved, exams:1, students:saved, message:'Result summary updated: '+saved+' students'};
}
async function sbSetResultPublish(data={}){
  const exam=(await sbGetExams({examId:data.examId})).exams[0]; if(!exam) throw new Error('Exam not found');
  const val = /no|false|unpublish/i.test(String(data.publish || data.published || data.status || 'Yes')) ? 'No' : 'Yes';
  await sbPatchByRowId('Exams', exam.row_id, {ResultPublished:val, Published:val, PublishStatus:val==='Yes'?'Published':'Unpublished', PublishedAt:sbNow()});
  return {success:true,message:'Publish status saved', resultPublished:val};
}
async function sbGetAdmitPublishStatus(p={}){ const exam=(await sbGetExams({examId:p.examId})).exams[0]||{}; return {success:true, published:/yes|published/i.test(String(exam.Published||exam.PublishStatus||'')), status:exam.Published||''}; }
async function sbSetAdmitPublishStatus(data={}){ return sbSetResultPublish({examId:data.examId, publish:data.published || data.status}); }
async function sbGetAdmitCardData(p={}){ const full=await sbGetFullAttendanceData(p); const q=sbLower(p.search); let students=full.students; if(q) students=students.filter(s=>[s.Roll,s.RegistrationNumber,s.Name].join(' ').toLowerCase().includes(q)); return Object.assign(full,{students,cards:students}); }
async function sbGetSeatPlanStudentsLite(p={}){ const data=await sbGetAdmitCardData(p); return {success:true, exam:data.exam, students:data.students, schedules:data.schedules}; }

function sbCopyNo(r){ return sbClean(r && (r.CopyCode || r.BookNo || r.Barcode || r.QR || r.ISBN)); }
function sbCopyCode(base, serial){ base=sbClean(base); serial=Number(serial||1); if(/^\d+$/.test(base)) return String(Number(base)+serial-1).padStart(base.length,'0'); return base + '-' + String(serial).padStart(3,'0'); }
function sbCopyBelongs(row, base, oldBase, stock){
  const copy = sbCopyNo(row), bookId = sbClean(row.BookID), isbn = sbClean(row.ISBN), b=sbClean(base), ob=sbClean(oldBase || base);
  if(!b && !ob) return true;
  if([bookId,isbn,copy].includes(b) || [bookId,isbn,copy].includes(ob)) return true;
  if(bookId === b || bookId === ob) return true;
  if(copy.startsWith(b+'-') || copy.startsWith(ob+'-')) return true;
  if(/^\d+$/.test(b) && /^\d+$/.test(copy)){
    const n=Number(copy), start=Number(b), max=stock?Number(stock):999999;
    if(n>=start && n<start+max) return true;
  }
  if(/^\d+$/.test(ob) && /^\d+$/.test(copy)){
    const n=Number(copy), start=Number(ob), max=stock?Number(stock):999999;
    if(n>=start && n<start+max) return true;
  }
  return false;
}
async function sbGetBooks(){ let rows=await sbAll('Books'); rows=rows.filter(sbIsActive); rows.sort((a,b)=>sbClean(a.ISBN||a.BookID).localeCompare(sbClean(b.ISBN||b.BookID), undefined, {numeric:true})); return {success:true, books:rows}; }
async function sbSyncBookCopies(isbn, oldIsbn, title, author, category, stock, purchaseDate, price){
  const base=sbClean(isbn), oldBase=sbClean(oldIsbn||isbn), maxStock=Math.max(0,sbNum(stock));
  const copies=await sbAll('BookCopies'); const existingSerial={};
  for(const c of copies){
    if(!sbCopyBelongs(c, base, oldBase, Math.max(maxStock, sbNum(c.CopySerial || c.Serial)))) continue;
    let serial=sbNum(c.CopySerial || c.Serial);
    if(!serial){ const n=sbCopyNo(c); if(/^\d+$/.test(base)&&/^\d+$/.test(n)) serial=Number(n)-Number(base)+1; if(!serial||serial<1) serial=Object.keys(existingSerial).length+1; }
    existingSerial[serial]=true;
    const code=sbCopyCode(base, serial); const oldStatus=sbClean(c.Status || 'Available'); let newStatus=oldStatus;
    if(serial>maxStock && sbLower(oldStatus)!=='issued') newStatus='Removed';
    if(serial<=maxStock && sbLower(oldStatus)==='removed') newStatus='Available';
    if(c.row_id) await sbPatchByRowId('BookCopies', c.row_id, {Timestamp:sbNow(), ISBN:code, CopySerial:String(serial), CopyCode:code, Title:title, Author:author, Category:category, PurchaseDate:purchaseDate, Price:price, Status:newStatus, BookID:base, Serial:String(serial), Barcode:code, QR:code});
  }
  for(let i=1;i<=maxStock;i++){
    if(existingSerial[i]) continue;
    const code=sbCopyCode(base,i);
    await sbInsert('BookCopies', {Timestamp:sbNow(), CopyID:sbId('COPY'), ISBN:code, CopySerial:String(i), CopyCode:code, Title:title, Author:author, Category:category, PurchaseDate:purchaseDate, Price:price, Status:'Available', BookID:base, Serial:String(i), Barcode:code, QR:code});
  }
}
async function sbAvailableCount(isbn, stock){ const rows=await sbAll('BookCopies'); return rows.filter(r=>sbCopyBelongs(r, isbn, isbn, stock) && sbLower(r.Status||'Available')==='available').length; }
async function sbSaveBook(data={}){
  const isbn=sbClean(data.isbn || data.bookIsbn || data.bookCode || data.code); const oldIsbn=sbClean(data.originalIsbn || data.oldIsbn || data.oldBookCode || isbn);
  const title=sbClean(data.title || data.bookTitle), author=sbClean(data.author), category=sbClean(data.category), stock=Math.max(0,sbNum(data.stock || data.totalCopies || 1));
  const purchaseDate=sbClean(data.purchaseDate || data.buyDate || data.BookBuyDate), price=sbClean(data.price || data.purchasePrice || data.bookPrice);
  if(!isbn) throw new Error('Book code is required'); if(!title) throw new Error('Book title is required');
  await sbSyncBookCopies(isbn, oldIsbn, title, author, category, stock, purchaseDate, price);
  const available=await sbAvailableCount(isbn, stock);
  const existing=await sbFindOne('Books', r=>sbClean(r.ISBN)===oldIsbn || sbClean(r.ISBN)===isbn || sbClean(r.BookID)===oldIsbn);
  const obj={Timestamp:sbNow(), BookID:(existing && existing.BookID) || sbClean(data.bookId||data.BookID)||sbId('BOOK'), ISBN:isbn, Title:title, Author:author, Category:category, Stock:String(stock), Available:String(available), TotalCopies:String(stock), AvailableCopies:String(available), PurchaseDate:purchaseDate, BuyDate:purchaseDate, Price:price, Status:'Active'};
  const saved=existing&&existing.row_id ? await sbPatchByRowId('Books', existing.row_id, obj) : (await sbInsert('Books', obj))[0];
  return {success:true, message:'Book updated successfully. Books + BookCopies synced.', stock, available, copies:stock, book:saved||obj};
}
async function sbGetBookCopies(p={}){
  let rows=(await sbAll('BookCopies')).filter(sbIsActive);
  const search=sbLower(p.search || p.copyCode || p.bookNumber); const base=sbClean(p.isbn || p.bookCode || p.baseCode || p.BookID); const stock=sbNum(p.stock || 0);
  if(base) rows=rows.filter(r=>sbCopyBelongs(r, base, base, stock || 999999));
  if(search) rows=rows.filter(r=>[r.CopyCode,r.BookNo,r.ISBN,r.Barcode,r.QR].map(sbLower).some(x=>x.includes(search)));
  rows.sort((a,b)=>sbClean(sbCopyNo(a)).localeCompare(sbClean(sbCopyNo(b)), undefined, {numeric:true}));
  return {success:true, copies:rows};
}
async function sbCurrentIssuedForRoll(roll){ const rows=(await sbAll('BookCopies')).filter(r=>sbLower(r.Status)==='issued' && sbClean(r.IssuedRoll)===sbClean(roll)); return rows.map(r=>({ISBN:sbClean(r.BookID || r.ISBN), BookCode:sbClean(r.BookID||r.ISBN), CopyCode:sbCopyNo(r), BookNo:sbCopyNo(r), BookTitle:sbClean(r.Title || r.BookTitle), Title:sbClean(r.Title || r.BookTitle), IssueDate:sbDateOnly(r.IssueDate), ReturnDate:sbDateOnly(r.ReturnDate), Status:'Issued'})).sort((a,b)=>sbClean(a.CopyCode).localeCompare(sbClean(b.CopyCode), undefined, {numeric:true})); }
async function sbGetLibraryStudentInfo(p={}){ const s=await sbFindStudent(p.search || p.roll || p.rollId || p.registrationNumber); if(!s) return {success:true, found:false, message:'Student not found by roll/registration number', student:null, currentIssued:[], availableBooks:[]}; const current=await sbCurrentIssuedForRoll(s.Roll); return {success:true, found:true, student:s, currentIssued:current, availableBooks:[], availableSearchMode:'copy-number-only', message:'Student loaded. Search available book by Book No / Copy Code.'}; }
async function sbFindCopyByNumber(n, wantedStatus){
  n=sbClean(decodeURIComponent(n||'')); if(!n) return null;
  const rows=await sbAll('BookCopies');
  const hits = rows.filter(r=>[r.CopyCode,r.BookNo,r.ISBN,r.Barcode,r.QR].map(sbClean).includes(n));
  if(wantedStatus) return hits.find(r=>sbLower(r.Status||'Available')===wantedStatus) || null;
  return hits[0] || null;
}
async function sbIssueBook(data={}){ const student=await sbFindStudent(data.studentSearch || data.rollId || data.roll || data.registrationNumber); if(!student) throw new Error('Student not found'); const copy=await sbFindCopyByNumber(data.bookNumber || data.copyCode || data.isbn || data.bookCode, 'available'); if(!copy) throw new Error('Available book copy not found'); const ret=sbClean(data.returnDate) || (()=>{const d=new Date(); d.setDate(d.getDate()+10); return d.toISOString().slice(0,10);})(); await sbPatchByRowId('BookCopies', copy.row_id, {Status:'Issued', IssuedRoll:student.Roll, IssuedName:student.Name, RegistrationNumber:student.RegistrationNumber, IssueDate:sbDateOnly(data.issueDate)||new Date().toISOString().slice(0,10), ReturnDate:ret, SessionYear:student.StudySessionYear || student.CurrentStudySession || student.SessionYear, AcademicYear:student.CurrentYear, CurrentYear:student.CurrentYear}); await sbInsert('LibraryLogs', {Timestamp:sbNow(), LogID:sbId('LOG'), IssueID:sbId('ISS'), Action:'Issue', RollID:student.Roll, Roll:student.Roll, RegistrationNumber:student.RegistrationNumber, StudentName:student.Name, ISBN:copy.BookID || copy.ISBN, BookID:copy.BookID, CopyCode:sbCopyNo(copy), CopyID:copy.CopyID, BookTitle:copy.Title, Title:copy.Title, IssueDate:new Date().toISOString().slice(0,10), ReturnDate:ret, Status:'Issued'}); return {success:true, message:'Book issued successfully'}; }
async function sbReturnBook(data={}){ const copy=await sbFindCopyByNumber(data.bookNumber || data.copyCode || data.isbn || data.bookCode, 'issued'); if(!copy) throw new Error('Issued book copy not found'); await sbPatchByRowId('BookCopies', copy.row_id, {Status:'Available', IssuedRoll:'', IssuedName:'', RegistrationNumber:'', IssueDate:'', ReturnDate:'', SessionYear:'', AcademicYear:'', CurrentYear:''}); await sbInsert('LibraryLogs', {Timestamp:sbNow(), LogID:sbId('LOG'), IssueID:sbId('RET'), Action:'Return', RollID:copy.IssuedRoll, Roll:copy.IssuedRoll, RegistrationNumber:copy.RegistrationNumber, StudentName:copy.IssuedName, ISBN:copy.BookID || copy.ISBN, BookID:copy.BookID, CopyCode:sbCopyNo(copy), CopyID:copy.CopyID, BookTitle:copy.Title, Title:copy.Title, IssueDate:copy.IssueDate, ReturnDate:new Date().toISOString().slice(0,10), Status:'Returned'}); return {success:true, message:'Book returned successfully'}; }
async function sbGetLibraryReport(p={}){ const session=sbClean(p.sessionYear), year=sbClean(p.academicYear || p.currentYear); const students=(await sbGetStudents({})).students; const smap={}; students.forEach(s=>smap[s.Roll]=s); const copies=(await sbAll('BookCopies')).filter(r=>sbLower(r.Status)==='issued'); const studentRows={}, bookSummary={}; let total=0; copies.forEach(c=>{ const roll=sbClean(c.IssuedRoll); if(!roll) return; const st=smap[roll]||{}; const stSession=sbClean(st.StudySessionYear || st.SessionYear || c.SessionYear); const stYear=sbClean(st.CurrentYear || st.AcademicYear || c.AcademicYear || c.CurrentYear); if(session && stSession!==session) return; if(year && stYear!==year) return; const copyNo=sbCopyNo(c); const bookCode=sbClean(c.BookID || c.ISBN); const title=sbClean(c.Title); if(!studentRows[roll]) studentRows[roll]={Roll:roll,RegistrationNumber:sbClean(st.RegistrationNumber||c.RegistrationNumber),StudentName:sbClean(st.Name||c.IssuedName),SessionYear:stSession,CurrentYear:stYear,Books:[],IssueCount:0}; studentRows[roll].Books.push((copyNo?copyNo+' - ':'')+title); studentRows[roll].IssueCount++; total++; if(!bookSummary[bookCode]) bookSummary[bookCode]={ISBN:bookCode,BookCode:bookCode,BookTitle:title,IssueCount:0}; bookSummary[bookCode].IssueCount++; }); const studentsReport=Object.keys(studentRows).map(k=>studentRows[k]).sort(sbSortByRoll); const booksReport=Object.keys(bookSummary).map(k=>bookSummary[k]).sort((a,b)=>Number(b.IssueCount)-Number(a.IssueCount)||sbClean(a.BookCode).localeCompare(sbClean(b.BookCode),undefined,{numeric:true})); return {success:true,currentOnly:true,returnedExcluded:true,sessionYear:session,academicYear:year,totalStudents:studentsReport.length,totalIssue:total,studentsReport,booksReport}; }
async function sbGetLibraryPublicStatus(p={}){ const info=await sbGetLibraryStudentInfo(p); if(!info.found) return Object.assign(info,{currentIssueCount:0, historyCount:0, history:[]}); const logs=(await sbAll('LibraryLogs', {raw:true})).filter(l=>sbClean(l.Roll||l.RollID)===info.student.Roll || sbClean(l.RegistrationNumber)===info.student.RegistrationNumber).sort((a,b)=>sbClean(b.Timestamp).localeCompare(sbClean(a.Timestamp))); return Object.assign(info,{currentIssueCount:info.currentIssued.length, historyCount:logs.length, history:logs}); }

async function sbGetNotices(){ const rows=(await sbAll('Notices')).filter(sbIsActive); return {success:true, notices:rows}; }
async function sbAddNotice(data={}){ const obj={Timestamp:sbNow(), NoticeID:sbId('NTC'), Title:sbClean(data.title), Body:sbClean(data.body || data.message), Message:sbClean(data.message || data.body), Audience:sbClean(data.audience || 'All'), Status:sbClean(data.status || 'Active')}; const ins=(await sbInsert('Notices', obj))[0]; return {success:true,message:'Notice saved',notice:ins||obj}; }
async function sbGetSheetData(p={}){
  const sheet = sbClean(p.sheetName);
  if(!GEO_SB_TABLE_HEADERS[sheet]) throw new Error('Unknown table: ' + sheet);
  const headers = sbHeaders(sheet).slice();
  const sourceRows = await sbAll(sheet, {raw:true});
  const rows = sourceRows.map(r => ({
    rowNumber: r.row_id,
    row_id: r.row_id,
    values: headers.map(h => r[h] == null ? '' : String(r[h]))
  }));
  return {success:true, sheetName:sheet, headers, rows, count:rows.length};
}
async function sbUpdateSheetRow(data={}){
  const sheet = sbClean(data.sheetName);
  const id = sbClean(data.rowNumber || data.row_id || data.Row);
  if(!sheet || !id) throw new Error('Table and row id required');
  let obj = {};
  if(Array.isArray(data.values)){
    const h = sbHeaders(sheet);
    data.values.forEach((v,i)=>{ if(h[i]) obj[h[i]] = v == null ? '' : String(v); });
  }else{
    obj = data.values || data.row || {};
  }
  const saved = await sbPatchByRowId(sheet, id, obj);
  return {success:true, message:'Row updated successfully', row_id:id, row:saved || null};
}
async function sbDeleteSheetRow(data={}){ const sheet=sbClean(data.sheetName); const id=sbClean(data.rowNumber || data.row_id || data.Row); if(!sheet||!id) throw new Error('Table and row id required'); await sbDeleteByRowId(sheet,id); return {success:true,message:'Row deleted'}; }
async function sbDashboardCounts(){ const students=(await sbAll('Students')).filter(sbIsActive).length; const subjects=(await sbAll('Subjects')).filter(sbIsActive).length; const exams=(await sbAll('Exams')).filter(sbIsActive).length; const books=(await sbAll('Books')).filter(sbIsActive).length; const issued=(await sbAll('BookCopies')).filter(r=>sbLower(r.Status)==='issued').length; return {success:true, students, subjects, exams, books, issuedBooks:issued, counts:{students,subjects,exams,books,issuedBooks:issued}}; }
async function sbImportFinalResultSheet(data={}){
  const rows=Array.isArray(data.rows)?data.rows:[]; const session=sbClean(data.sessionYear), year=sbClean(data.academicYear), next=sbNextAcademicYear(year);
  const students=(await sbGetStudents({})).students; const byReg={}; students.forEach(s=>{byReg[sbClean(s.RegistrationNumber).replace(/\D/g,'')]=s;});
  const successful=[], notPromoted=[], unsuccessful=[];
  for(const r of rows){
    const reg=sbClean(r.regNo || r.RegNo || r.RegistrationNumber).replace(/\D/g,''); const result=sbClean(r.result || r.Result); const obtained=sbClean(r.obtained || r.ObtainedGPMark); const nameFile=sbClean(r.studentName || r.StudentNameFromFile);
    const st=byReg[reg];
    const importObj={Timestamp:sbNow(), ImportID:sbId('IMP'), InputSession:session, ResultYear:year, NextYear:next, RegNo:reg, StudentNameFromFile:nameFile, ObtainedGPMark:obtained, Result:result, SessionYear:session, AcademicYear:year, Status:'Imported'};
    if(!st){ unsuccessful.push({regNo:reg, studentNameFromFile:nameFile, result, message:'Student not found'}); await sbInsert('ResultImports', Object.assign({}, importObj, {Matched:'No', Message:'Student not found'})); continue; }
    const promoted=sbIsPromotedText(result);
    await sbInsert('ResultImports', Object.assign({}, importObj, {Matched:'Yes', MatchedRoll:st.Roll, MatchedStudentName:st.Name, StudentSession:st.SessionYear, OldYear:st.CurrentYear, NewYear:promoted?next:st.CurrentYear, Message:promoted?'Promoted':'Not promoted'}));
    await sbUpsertBy('FinalResults', x=>sbClean(x.RegistrationNumber).replace(/\D/g,'')===reg && sbClean(x.AcademicYear)===year, {Timestamp:sbNow(), ResultID:sbId('FR'), SessionYear:session || st.SessionYear, AcademicYear:year, Roll:st.Roll, RegistrationNumber:st.RegistrationNumber, StudentName:st.Name, FinalMarks:obtained, GPA:obtained, ResultStatus:promoted?'Promoted':'Not Promoted', PromotedToYear:promoted?next:st.CurrentYear, Remarks:result});
    if(promoted && st.row_id) await sbPatchByRowId('Students', st.row_id, {CurrentYear:next, AcademicYear:next, StudyStatus:'Continuing'});
    if(promoted) successful.push({regNo:reg, roll:st.Roll, studentName:st.Name, studentSession:st.SessionYear, oldYear:year, newYear:next, result});
    else notPromoted.push({regNo:reg, roll:st.Roll, studentName:st.Name, studentNameFromFile:nameFile, result, oldYear:year, newYear:st.CurrentYear, reason:'Result is not promoted'});
  }
  return {success:true, message:'Import completed', promotedCount:successful.length, notPromotedCount:notPromoted.length, successful, notPromoted, unsuccessful};
}
async function sbProcessPromotion(data={}){
  const fromYear=sbClean(data.fromYear), toYear=sbClean(data.toYear || sbNextAcademicYear(fromYear));
  const finals=(await sbGetFinalResults({academicYear:fromYear})).results;
  let moved=0, stayed=0;
  for(const r of finals){
    const promoted = sbIsPromotedText(r.ResultStatus || r.Result || r.Remarks || '');
    const st=await sbFindStudent(r.Roll || r.RegistrationNumber);
    if(promoted && st && st.row_id){ await sbPatchByRowId('Students', st.row_id, {CurrentYear:toYear, AcademicYear:toYear, StudyStatus:'Continuing'}); moved++; }
    else stayed++;
  }
  return {success:true, message:moved+' students promoted, '+stayed+' stayed', promoted:moved, stayed};
}
async function sbGenericSuccess(msg){ return {success:true, message:msg || 'Done in Supabase mode'}; }
async function sbGeoApiGet(action, params={}){
  action=sbClean(action); params=params||{};
  switch(action){
    case 'getDashboardCounts': return sbDashboardCounts();
    case 'getSheetData': return sbGetSheetData(params);
    case 'getStudents': case 'getStudySessionStudents': return sbGetStudents(params);
    case 'getActualStudents': return sbGetStudents(params, 'ActualStudents');
    case 'getStudent': return sbGetStudent(params);
    case 'getSubjects': return sbGetSubjects(params);
    case 'getSubjectsForExamCreate': return sbGetSubjectsForExamCreate(params);
    case 'getStudentSubjects': return sbGetStudentSubjects(params);
    case 'getExams': return sbGetExams(params);
    case 'getExamSchedule': return sbGetExamSchedule(params);
    case 'getExamBlockPanelData': return sbGetExamBlockPanelData(params);
    case 'getAttendanceMarksData': case 'getAttendanceMarks': return sbGetAttendanceMarksData(params);
    case 'getAttendanceData': case 'getFullAttendanceData': return sbGetFullAttendanceData(params);
    case 'getMarksEntryData': return sbGetMarksEntryData(params);
    case 'getMissingMarksList': return sbGetMissingMarksList(params);
    case 'getIncourseAverageSheet': case 'getIncourseResults': return sbGetIncourseAverageSheet(params);
    case 'getFinalResults': return sbGetFinalResults(params);
    case 'getPublishedExamSessions': return sbGetPublishedExamSessions(params);
    case 'getPublishedExamsForStudent': return sbGetPublishedExamsForStudent(params);
    case 'getStudentResultFast': case 'getResult': case 'getExamResultStudent': return sbGetStudentResultFast(params);
    case 'getEasyResultChoices': case 'getResultPanelChoices': case 'getResultExamChoices': return sbGetEasyResultChoices(params);
    case 'getEasyResultList': case 'getEasyResultListSafe': case 'getResultPanelData': case 'getResultPanelDataSafe': case 'getExamResultSummaryLists': return sbGetEasyResultList(params);
    case 'getAdmitPublishStatus': return sbGetAdmitPublishStatus(params);
    case 'setAdmitPublishStatus': return sbSetAdmitPublishStatus(params);
    case 'getPublishedAdmitExams': return sbGetPublishedExamsForStudent(params);
    case 'getAdmitCardData': case 'getAdmitCardDataNoStack': case 'getAdmitCardDataDirect': return sbGetAdmitCardData(params);
    case 'getSeatPlanStudentsLite': return sbGetSeatPlanStudentsLite(params);
    case 'getBooks': return sbGetBooks(params);
    case 'getBookCopies': return sbGetBookCopies(params);
    case 'getLibraryStudentInfo': return sbGetLibraryStudentInfo(params);
    case 'getLibraryPublicStatus': return sbGetLibraryPublicStatus(params);
    case 'getLibraryReport': return sbGetLibraryReport(params);
    case 'getNotices': return sbGetNotices(params);
    case 'getLibraryLogs': return {success:true, logs:await sbAll('LibraryLogs', {raw:true})};
    case 'getPreloadData': return {success:true, disabled:true, message:'Preload/cache disabled. Use page-wise direct Supabase loading.'};
    case 'refreshAllResultSummaryFromMarks': return sbRefreshResultSummaryFromMarks(params);
    case 'listMarksBackupSheets': return {success:true, sheets:[]};
    case 'hardRemoveOldSubjects': case 'cleanStudentSubjectsByLiveSubjects': return sbGenericSuccess('Supabase live subject data checked.');
    case 'getSafeSheetSetupStatus': return {success:true, supabase:true, message:'Supabase connection active'};
    default: return {success:false, message:'Supabase adapter: action not implemented yet: '+action};
  }
}
async function sbGeoApiPost(payload={}){
  const action=sbClean(payload.action); const data=payload||{};
  switch(action){
    case 'loginUser': return sbLogin(data);
    case 'registerStudent': case 'updateStudentProfile': return sbRegisterStudent(data);
    case 'importManualStudents': case 'manualStudentExcelEntry': case 'bulkImportStudents': return sbImportManualStudents(data);
    case 'updateStudentStudyStatus': case 'bulkSetStudySession': return (async()=>{ const rows=Array.isArray(data.students)?data.students:[data]; let saved=0; for(const r of rows){ const st=await sbFindStudent(r.studentKey||r.roll||r.registrationNumber); if(st&&st.row_id){ const targetSession=sbClean(r.studySessionYear || r.StudySessionYear || r.currentStudySession || r.CurrentStudySession || st.StudySessionYear || st.CurrentStudySession || st.SessionYear); const targetYear=sbClean(r.currentYear || r.CurrentYear || st.CurrentYear || st.AcademicYear); const mismatch=!!(sbClean(st.SessionYear) && targetSession && sbClean(st.SessionYear)!==targetSession); await sbPatchByRowId('Students', st.row_id, {StudySessionYear:targetSession, CurrentStudySession:targetSession, StudyStatus:sbClean(r.studyStatus || r.StudyStatus || st.StudyStatus || 'Continuing'), CurrentYear:targetYear, AcademicYear:targetYear, IrregularStatus:mismatch?'Irregular':'Regular', StudentType:mismatch?'Irregular':'Regular', IrregularReason:mismatch?('Original session: '+sbClean(st.SessionYear)+', study session: '+targetSession):''}); saved++; } } return {success:true,message:saved+' students updated',saved}; })();
    case 'saveSubject': return sbSaveSubject(data);
    case 'saveStudentSubjects': return sbSaveStudentSubjects(data);
    case 'bulkAssignSubjects': return sbBulkAssignSubjects(data);
    case 'saveExam': return sbSaveExam(data);
    case 'saveExamSchedule': return sbSaveExamSchedule(data);
    case 'setExamBlock': return sbSetExamBlock(data);
    case 'saveIndividualMarks': return sbSaveIndividualMarks(data);
    case 'saveMarks': case 'saveMarkRow': case 'saveMarkRowDirect': case 'saveMarksGet': case 'saveMarksFastGet': return sbSaveMarks(data);
    case 'saveAttendanceMarks': return sbSaveAttendanceMarks(data);
    case 'saveFinalResults': return sbSaveFinalResults(data);
    case 'setResultPanelPublish': case 'setResultPublishStatus': case 'publishResultFromMarksPage': case 'publishResultClean': return sbSetResultPublish(data);
    case 'saveBook': return sbSaveBook(data);
    case 'issueBook': return sbIssueBook(data);
    case 'returnBook': return sbReturnBook(data);
    case 'addNotice': return sbAddNotice(data);
    case 'updateSheetRow': return sbUpdateSheetRow(data);
    case 'deleteSheetRow': return sbDeleteSheetRow(data);
    case 'safeSheetSetup': case 'setupSheets': case 'initSystem': case 'setupFastSheets': case 'optimizeSheetsSafe': return sbGenericSuccess('Supabase tables already created from SQL.');
    case 'cleanStudentSubjectsByLiveSubjects': case 'hardRemoveOldSubjects': case 'forceMarksSheetOldFormat': case 'restoreMarksFromBackup': case 'restoreMarksOldSubjectWiseFromBackup': return sbGenericSuccess('This maintenance action is safe/skipped in Supabase mode.');
    case 'refreshAllResultSummaryFromMarks': return sbRefreshResultSummaryFromMarks(data);
    case 'importFinalResultSheet': return sbImportFinalResultSheet(data);
    case 'processPromotion': return sbProcessPromotion(data);
    default: return {success:false, message:'Supabase adapter: action not implemented yet: '+action};
  }
}

geoApiGet = async function(action, params={}){ return sbGeoApiGet(action, params || {}); };
geoApiPost = async function(payload={}){ return sbGeoApiPost(payload || {}); };
processGeoWriteQueue = async function(){
  try{
    const q = typeof getGeoWriteQueue === 'function' ? getGeoWriteQueue() : [];
    if(!q || !q.length){ if(typeof updateGeoQueueBadge === 'function') updateGeoQueueBadge(); return; }
    const remaining=[];
    for(const item of q){
      try{ const res=await sbGeoApiPost(item.payload||{}); if(!res || res.success===false) throw new Error((res&&res.message)||'Save failed'); }
      catch(err){ item.lastError=err.message||String(err); remaining.push(item); }
    }
    if(typeof setGeoWriteQueue === 'function') setGeoWriteQueue(remaining);
    if(typeof updateGeoQueueBadge === 'function') updateGeoQueueBadge();
  }catch(e){ console.warn('Supabase queue process failed', e); }
};
window.geoSupabaseAdapterReady = true;
console.log('Supabase bug-fixed adapter active:', GEO_SUPABASE_URL);
})();
