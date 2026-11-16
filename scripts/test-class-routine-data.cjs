const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/class-routine-data.js'),'utf8'),context);
const data = JSON.parse(JSON.stringify(context.window.GEO_CLASS_ROUTINE_DATA));

assert.equal(data.effectiveDate,'2026-11-12');
assert.equal(data.distributionDate,'2026-11-11');
assert.deepEqual(data.days,['Sunday','Monday','Tuesday','Wednesday','Thursday']);
assert.deepEqual(data.periods.map(p=>p.id),[0,1,2,3,4,5,6]);
assert.deepEqual(data.periods.map(p=>[p.start,p.end]),[
  ['09:00','09:45'],['09:45','10:30'],['10:30','11:15'],['11:15','12:00'],
  ['12:30','13:15'],['13:15','14:00'],['14:00','15:00']
]);
assert.deepEqual([data.break.start,data.break.end,data.break.afterPeriod],['12:00','12:30',3]);
assert.equal(data.entries.length,95);
assert.equal(data.courses.length,31);
assert.equal(new Set(data.entries.map(e=>e.id)).size,95);
assert.equal(new Set(data.courses.map(c=>c.id)).size,31);
assert.deepEqual(Object.fromEntries(data.days.map(day=>[day,data.entries.filter(e=>e.day===day).length])),{
  Sunday:20,Monday:24,Tuesday:20,Wednesday:18,Thursday:13
}); // Counts independently tallied from the five source rows.

const teacherCodes = new Set(data.teachers.map(t=>t.code));
assert.equal(teacherCodes.size,data.teachers.length);
assert.deepEqual([...teacherCodes].sort(),['AM','RS','SR','ZR']);
assert.equal(data.entries.filter(e=>e.uncertain).length,14);
for(const e of data.entries){
  assert(data.days.includes(e.day),e.id+' day');
  assert(data.periods.some(p=>p.id===e.period),e.id+' period');
  assert(data.levels.includes(e.level),e.id+' year');
  assert(e.sourceText,e.id+' source');
  assert.equal(typeof e.uncertain,'boolean');
  assert.equal(typeof e.note,'string');
  assert.equal(typeof e.room,'string');
  assert.equal(typeof e.subject,'string');
  for(const code of e.teacherCodes) assert(teacherCodes.has(code),e.id+' teacher');
  if(e.uncertain) assert(e.note,e.id+' explanation');
}
for(const c of data.courses){
  assert(data.levels.includes(c.level),c.id+' year');
  assert(c.title,c.id+' title');
  assert(c.code==='' || /^\d{6}$/.test(c.code),c.id+' code');
  for(const code of c.teacherCodes) assert(teacherCodes.has(code),c.id+' teacher');
}
function entry(day,period,level){return data.entries.find(e=>e.day===day&&e.period===period&&e.level===level);}
assert.deepEqual(entry('Sunday',0,'Degree 3rd Year').teacherCodes,['AM']);
assert.equal(entry('Sunday',0,'Degree 3rd Year').room,'407');
assert.deepEqual(entry('Monday',4,'Honours 1st Year').teacherCodes,['RS']);
assert.deepEqual(entry('Tuesday',6,'Honours 2nd Year').teacherCodes,['SR']);
assert.equal(entry('Tuesday',6,'Honours 2nd Year').uncertain,false);
assert(entry('Tuesday',6,'Honours 2nd Year').note.includes('15 November 2026'));
assert(entry('Tuesday',6,'Honours 2nd Year').sourceText.includes('SH'));
assert(!data.teachers.some(t=>t.code==='SH'));
assert.equal(data.teachers.find(t=>t.code==='SR').name,'Md. Sohel Rana');
assert.equal(entry('Wednesday',6,'Masters').room,'');
assert.deepEqual(entry('Wednesday',6,'Masters').teacherCodes,[]);
assert.deepEqual(entry('Thursday',6,'Honours 3rd Year').teacherCodes,[]);
assert.equal(entry('Thursday',6,'Honours 3rd Year').room,'407');
assert.equal(entry('Thursday',4,'XI').subject,'Humanities B');
assert.equal(entry('Sunday',5,'XI').room,'201');

const allPractical = entry('Tuesday',5,'Honours 1st Year');
assert.equal(allPractical.subject,'Practical: all');
assert.deepEqual(allPractical.teacherCodes,[],'ALL must not infer assignments to all staff');
for(const e of data.entries.filter(e=>e.subject.startsWith('Non-major:'))){
  assert.deepEqual(e.teacherCodes,[],e.id+' NM must not infer a teacher');
}
const blankCodes = data.courses.filter(c=>c.code==='');
assert.equal(blankCodes.length,2);
assert(blankCodes.every(c=>c.title==='Information and Communication Technology'));
assert.deepEqual(blankCodes.find(c=>c.level==='Honours 2nd Year').teacherCodes,[]);
assert(data.courses.find(c=>c.code==='213201').notes.includes('Verify'));
assert.equal(data.courses.find(c=>c.code==='213201').title,'Information and Communication Technology');
assert.deepEqual(data.courses.find(c=>c.code==='223201').teacherCodes,['RS','AM']);
assert.deepEqual(data.courses.find(c=>c.code==='313226').teacherCodes,['RS','ZR','SR']);
assert.equal(data.courses.find(c=>c.code==='313209').title,'Climate Change Mitigation & Migration');

const simultaneous = new Map();
for(const e of data.entries) for(const t of e.teacherCodes){
  const key=e.day+'|'+e.period+'|'+t;
  simultaneous.set(key,(simultaneous.get(key)||0)+1);
}
assert.deepEqual([...simultaneous].filter(([,n])=>n>1).map(([k])=>k).sort(),[
  'Sunday|6|SR','Monday|0|SR','Monday|4|RS','Monday|6|SR','Tuesday|6|SR','Wednesday|1|SR'
].sort(),'Source overlaps must not be silently discarded');
console.log('PASS: 95 classes, 31 courses, four teachers, confirmed SR correction, 14 uncertain entries, dates/periods/IDs, independently tallied daily counts, source landmarks and six teacher overlaps.');
