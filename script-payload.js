const sessionEl = document.getElementById('sessionYear');
const yearEl = document.getElementById('academicYear');
const examSelect = document.getElementById('examSelect');
const studentSearchEl = document.getElementById('studentSearch');
const loadBtn = document.getElementById('loadStudentSubjects');
const head = document.getElementById('marksHead');
const table = document.getElementById('marksTable');
const statusEl = document.getElementById('marksStatus');

let exams = [], selectedExam = null, currentRoll = '', currentReg = '';

async function init(){
  const data = await geoApiGet('getExams');
  exams = data.exams || [];
  
  const years = [...new Set(exams.map(e=>String(e.AcademicYear||'').trim()).filter(Boolean))];
  fillSelect(yearEl, years.map(y=>({value:y,label:y})), 'Select year');
  
  const sessions = [...new Set(exams.map(e=>String(e.SessionYear||'').trim()).filter(Boolean))];
  fillSelect(sessionEl, sessions.map(y=>({value:y,label:y})), 'Select session');
  
  yearEl.addEventListener('change', filterExams);
  sessionEl.addEventListener('change', filterExams);
  
  loadBtn.addEventListener('click', loadStudentSubjects);
  document.getElementById('saveMarks').addEventListener('click', saveAllIndividualMarks);
}

function filterExams(){
  const s = sessionEl.value, y = yearEl.value;
  let matches = exams;
  if(s) matches = matches.filter(e => e.SessionYear === s);
  if(y) matches = matches.filter(e => e.AcademicYear === y);
  fillSelect(examSelect, matches.map(e=>({value:e.ExamID, label:e.ExamName || e.ExamID})), 'Select Exam');
}

async function loadStudentSubjects(){
  const examId = examSelect.value;
  const search = studentSearchEl.value.trim();
  if(!examId || !search) {
    showStatus(statusEl, 'err', 'Select Exam and enter Roll/Regi');
    return;
  }
  selectedExam = exams.find(e=>e.ExamID === examId);
  const btnText = loadBtn.textContent;
  loadBtn.textContent = 'Loading...'; loadBtn.disabled = true;
  
  const res = await geoApiGet('getStudentResultFast', {examId, search});
  
  let markDetails = res.rows && res.rows.length ? res.rows[0].markDetails : null;
  let st = res.rows && res.rows.length ? res.rows[0] : null;

  if(!markDetails || !markDetails.length) {
    const schedRes = await geoApiGet('getExamSchedule', {examId});
    if(schedRes.schedules && schedRes.schedules.length) {
       const studentsRes = await geoApiGet('getStudents', {search});
       const stu = (studentsRes.students || []).find(s => s.Roll == search || s.RegistrationNumber == search) || (studentsRes.students||[])[0];
       if(stu) {
         st = { roll: stu.Roll, reg: stu.RegistrationNumber, name: stu.Name || stu.StudentName };
         const subjectRes = await geoApiGet('getSubjects');
         const subjectMap = {};
         (subjectRes.subjects||[]).forEach(s => subjectMap[s.SubjectCode] = s.SubjectName);

         markDetails = schedRes.schedules.map(sch => {
            return {
               SubjectCode: sch.SubjectCode,
               SubjectName: subjectMap[sch.SubjectCode] || sch.SubjectCode,
               Marks: '', ExamMarks: '', AssignmentMarks: '', AttendanceMarks: '', Absent: ''
            };
         });
       }
    }
  }

  loadBtn.textContent = btnText; loadBtn.disabled = false;

  if(!st || !markDetails || !markDetails.length){
    table.innerHTML = '<tr><td colspan="6" class="empty">' + (res.message || 'No subjects found for this student in this exam') + '</td></tr>';
    head.innerHTML = '';
    return;
  }

  currentRoll = st.roll || st.Roll;
  currentReg = st.reg || st.RegistrationNumber;
  
  showStatus(statusEl, 'info', 'Loaded: ' + (st.name||st.StudentName||'') + ' (Roll: ' + currentRoll + ')');
  
  head.innerHTML = '<tr><th>Code</th><th class="text-left">Subject Name</th><th>Exam Marks</th><th>Assignment</th><th>Attendance</th><th>Total</th></tr>';
  
  let html = '';
  markDetails.forEach(sub => {
     const m = sub.Marks || sub.ExamMarks || '';
     const a = sub.AssignmentMarks || '';
     const at = sub.AttendanceMarks || '';
     const isAbsent = sub.Absent === 'Yes' || String(m).toLowerCase()==='a';
     const total = isAbsent ? 'Absent' : (Number(m)||0) + (Number(a)||0) + (Number(at)||0);
     
     html += `<tr data-code="${sub.SubjectCode}">
       <td class="text-center">${sub.SubjectCode}</td>
       <td class="text-left">${sub.SubjectName}</td>
       <td class="text-center"><input class="input mark-cell exam-mark" type="text" value="${m}" style="width:60px;text-align:center"></td>
       <td class="text-center"><input class="input mark-cell assignment-mark" type="text" value="${a}" style="width:60px;text-align:center"></td>
       <td class="text-center"><input class="input mark-cell attendance-mark" type="text" value="${at}" style="width:60px;text-align:center"></td>
       <td class="text-center total-cell"><b>${total}</b></td>
     </tr>`;
  });
  table.innerHTML = html;
}

async function saveAllIndividualMarks(){
  const trs = Array.from(table.querySelectorAll('tr[data-code]'));
  if(!trs.length) return;
  const btn = document.getElementById('saveMarks');
  const oldText = btn.textContent;
  btn.textContent = 'Saving...'; btn.disabled = true;
  
  const subjects = trs.map(tr => {
    return {
      subjectCode: tr.dataset.code,
      marks: tr.querySelector('.exam-mark')?.value || '',
      assignmentMarks: tr.querySelector('.assignment-mark')?.value || '',
      attendanceMarks: tr.querySelector('.attendance-mark')?.value || ''
    };
  });
  
  const res = await geoApiPost({
    action: 'saveIndividualMarks',
    examId: selectedExam.ExamID,
    roll: currentRoll,
    reg: currentReg,
    subjects: subjects
  });
  
  btn.textContent = oldText; btn.disabled = false;
  if(res.success){
    showStatus(statusEl, 'ok', 'All marks saved successfully for Roll ' + currentRoll);
  }else{
    showStatus(statusEl, 'err', res.message || 'Failed to save marks');
  }
}

document.addEventListener('input', e=>{
   if(e.target.classList.contains('mark-cell')){
      const tr = e.target.closest('tr');
      if(!tr) return;
      const m = Number(tr.querySelector('.exam-mark').value)||0;
      const a = Number(tr.querySelector('.assignment-mark').value)||0;
      const at = Number(tr.querySelector('.attendance-mark').value)||0;
      tr.querySelector('.total-cell b').textContent = m+a+at;
   }
});

init();
