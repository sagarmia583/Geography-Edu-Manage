const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/class-routine-checks.js'),'utf8'),context);
const analyze=context.window.GeoRoutineChecks.analyze;
const entry=(id,day,period,teacher,room,level='Honours 1st Year')=>({id,day,period,teacherCodes:teacher?[teacher]:[],room,level,subject:''});
const data={periods:[{id:0,start:'09:00',end:'10:00',label:'09–10'},{id:1,start:'10:00',end:'11:00',label:'10–11'},{id:2,start:'09:30',end:'10:30',label:'09:30–10:30'}],entries:[entry('a','Sunday',0,'SR','Room ৪০৮'),entry('b','Sunday',0,'ZR','408'),entry('c','Sunday',0,' sr ','409'),entry('d','Monday',0,'SR','408'),entry('e','Sunday',1,'SR','408')]};
let report=analyze(data);
assert.equal(report.groups.filter(g=>g.kind==='teacher').length,1);
assert.equal(report.groups.filter(g=>g.kind==='room').length,1);
 assert(report.groups.every(g=>/[\u0980-\u09ff]/.test(g.message)),'Conflict messages must be in Bangla');
assert.equal(report.byEntry.get('a').length,2);assert.equal(report.byEntry.get('d').length,0);assert.equal(report.byEntry.get('e').length,0);
// A filtered view must retain the report from the full data set.
assert.ok(report.byEntry.get('a').some(g=>g.message.includes('Honours 1st Year')));
data.entries.push(entry('f','Sunday',2,'SR','500'));report=analyze(data);assert.ok(report.byEntry.get('e').some(g=>g.kind==='teacher'));
data.entries=data.entries.slice(0,2);data.entries[1].room='409';report=analyze(data);assert.equal(report.groups.length,0);
data.entries=[entry('a','Sunday',0,'SR','408'),entry('b','Sunday',0,'SR','408','Honours 1st Year')];report=analyze(data);assert.ok(report.groups.some(g=>g.kind==='duplicate'));
data.entries=[entry('a','Sunday',0,'',''),entry('b','Sunday',0,'','—')];report=analyze(data);assert.ok(report.groups.every(g=>g.kind==='review'));assert.equal(report.byEntry.get('a').length,2);
data.entries[0].uncertain=true;data.entries[0].note='<untrusted note>';report=analyze(data);assert.ok(report.byEntry.get('a').some(g=>g.message.includes('<untrusted note>')));
 data.entries[0].note='Room is not specified in the source.';report=analyze(data);assert(report.byEntry.get('a').some(g=>g.message.includes('মূল রুটিনে কক্ষ উল্লেখ নেই')));
// Excluded classes generate no warnings and cannot create a conflict for an eligible class.
const excluded=['Degree 1st Year','Degree 2nd Year','Degree 3rd Year','XI','XII','Masters'].flatMap((level,i)=>[
 {...entry('excluded-'+i,'Sunday',0,'SR','408',level),uncertain:true,note:'Room is not specified in the source.'},
 {...entry('missing-'+i,'Sunday',0,'','',level),uncertain:true}
]);
excluded.push({...entry('nm','Sunday',0,'SR','408'),subject:'Non-major: Economics',uncertain:true}, {...entry('nm2','Sunday',0,'',''),subject:'NM: বাংলা',uncertain:true}, {...entry('ict','Sunday',0,'',''),subject:'ICT',uncertain:true});
data.entries=[entry('major','Sunday',0,'SR','408'),...excluded];report=analyze(data);
assert.equal(report.groups.length,0);
for(const e of excluded)assert.equal(report.byEntry.get(e.id).length,0);
data.entries.push(entry('major2','Sunday',0,'SR','408','Honours 2nd Year'));
report=analyze(data);assert(report.byEntry.get('major').length>0);assert(report.groups.every(issue=>issue.rows.every(e=>e.id==='major'||e.id==='major2')));
assert.equal(context.window.GeoRoutineChecks.nonMajorName(data,excluded.find(e=>e.id==='nm2')),'Bangla');
console.log('PASS: Honours-major-only diagnostics, excluded cohorts/non-major/ICT, normalized rooms/teachers, overlaps, duplicates and review notes.');
