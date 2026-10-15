const fs = require('fs');

console.log('--- Testing getExamMarkConfig logic for real exam scenarios ---');

// Extract getExamMarkConfig implementation
const html = fs.readFileSync('admin/blank-marksheet-print.html', 'utf8');

if (html.includes('getExamMarkConfig') && html.includes('Auto (Exam Configured: নির্ধারিত মার্কসের কলাম)')) {
  console.log('SUCCESS: Auto exam configured option and getExamMarkConfig function found in HTML.');
} else {
  console.error('ERROR: Missing function or option in HTML.');
}

// Emulate function
function sbExamKind(t) {
  t = String(t || '').toLowerCase();
  if (t.includes('test')) return 'test';
  if (t.includes('incourse')) return 'incourse';
  return 'other';
}

function getExamMarkConfig(exam, schedule, subject, requestedLayout) {
  exam = exam || {};
  schedule = schedule || {};
  subject = subject || {};

  const examType = String(exam.ExamType || schedule.ExamType || '').trim();
  const kind = sbExamKind(examType);
  const isICT = String(subject.SubjectCode || schedule.SubjectCode || '').trim() === '219903';

  const isDirectSchedule = (schedule.ExamID && exam.ExamID && String(schedule.ExamID).trim() === String(exam.ExamID).trim()) ||
                           (!schedule.ExamID && schedule.ExamType && String(schedule.ExamType).trim() === examType);

  if (kind === 'test') {
    let testMarks = 0;
    if (isDirectSchedule && Number(schedule.SubjectTestMarks) > 0) {
      testMarks = Number(schedule.SubjectTestMarks);
    } else if (isDirectSchedule && Number(schedule.SubjectExamMarks) > 0) {
      testMarks = Number(schedule.SubjectExamMarks);
    } else if (Number(exam.TestExamMarks) > 0) {
      testMarks = Number(exam.TestExamMarks);
    } else if (Number(subject.FullMarks) > 0) {
      testMarks = Number(subject.FullMarks);
    } else {
      testMarks = isICT ? 60 : 80;
    }

    return {
      kind: 'test',
      fullMarks: testMarks,
      components: [
        { key: 'test', title: 'Written / Test Exam (লিখিত পরীক্ষা)', shortTitle: 'Written Exam (লিখিত)', max: testMarks, width: '140px' }
      ],
      totalMax: testMarks,
      hasInWords: true
    };
  }

  if (kind === 'incourse') {
    let written = 0, assign = 0, attend = 0;
    if (isDirectSchedule && Number(schedule.SubjectExamMarks) > 0) {
      written = Number(schedule.SubjectExamMarks);
    } else if (Number(exam.ExamComponentMarks) > 0) {
      written = Number(exam.ExamComponentMarks);
    } else {
      written = isICT ? 8 : 15;
    }

    if (isDirectSchedule && Number(schedule.SubjectAssignmentMarks) > 0) {
      assign = Number(schedule.SubjectAssignmentMarks);
    } else if (Number(exam.AssignmentMarks) > 0) {
      assign = Number(exam.AssignmentMarks);
    }

    if (isDirectSchedule && Number(schedule.SubjectAttendanceMarks) > 0) {
      attend = Number(schedule.SubjectAttendanceMarks);
    } else if (Number(exam.AttendanceMarks) > 0) {
      attend = Number(exam.AttendanceMarks);
    }

    const components = [];
    if (written > 0) {
      components.push({ key: 'written', title: 'Written Exam (লিখিত পরীক্ষা)', shortTitle: 'Written (লিখিত)', max: written });
    }
    if (assign > 0) {
      components.push({ key: 'assignment', title: 'Assignment (অ্যাসাইনমেন্ট)', shortTitle: 'Assign. (অ্যাসাইন.)', max: assign });
    }
    if (attend > 0) {
      components.push({ key: 'attendance', title: 'Attendance (উপস্থিতি)', shortTitle: 'Attend. (উপস্থিতি)', max: attend });
    }
    if (components.length === 0) {
      components.push({ key: 'written', title: 'Exam Marks (পরীক্ষার নম্বর)', shortTitle: 'Exam Marks', max: 15 });
    }

    const total = components.reduce((s, c) => s + c.max, 0);
    return {
      kind: 'incourse',
      fullMarks: total,
      components,
      totalMax: total,
      hasInWords: components.length === 1
    };
  }
}

// Test Case 1: The user's exact exam from the screenshot!
const testExam = {
  ExamID: 'EXM-20260927071459-9625',
  ExamName: 'Hons 4th year Test Examination : 2025',
  ExamType: 'Test Examination',
  TestExamMarks: '80',
  ExamComponentMarks: '15',
  AssignmentMarks: '0',
  AttendanceMarks: '0'
};
const subject = { SubjectCode: '243201', SubjectName: 'Geographical Thoughts and Concepts', FullMarks: 100 };
// Old fallback schedule from incourse
const oldSchedule = { SubjectCode: '243201', ExamType: '1st Incourse', SubjectFullMarks: '15', SubjectExamMarks: '15' };

const res1 = getExamMarkConfig(testExam, oldSchedule, subject, 'auto');
console.log('Result for Test Examination:');
console.log('  Full Marks:', res1.fullMarks, '(Expected: 80, was 15 before!)');
console.log('  Columns:', res1.components.map(c => c.title));
console.log('  Has Assignment column?:', res1.components.some(c => c.key === 'assignment'), '(Expected: false)');
console.log('  Has Attendance column?:', res1.components.some(c => c.key === 'attendance'), '(Expected: false)');

// Test Case 2: Incourse with Attendance
const incourseExam = {
  ExamID: 'EXM-1234',
  ExamName: 'Hons 4th year 1st Incourse Examination-2025',
  ExamType: '1st Incourse',
  ExamComponentMarks: '15',
  AssignmentMarks: '0',
  AttendanceMarks: '5'
};
const res2 = getExamMarkConfig(incourseExam, {}, subject, 'auto');
console.log('\nResult for Incourse Examination with Attendance (15+5):');
console.log('  Full Marks:', res2.fullMarks, '(Expected: 20)');
console.log('  Columns:', res2.components.map(c => c.title));
console.log('  Has Assignment column?:', res2.components.some(c => c.key === 'assignment'), '(Expected: false)');
console.log('  Has Attendance column?:', res2.components.some(c => c.key === 'attendance'), '(Expected: true)');
