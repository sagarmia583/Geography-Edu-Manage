// Offline tests: no production database writes or browser automation.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const read=p=>fs.readFileSync(p,'utf8');
async function main(){
 const dom=new JSDOM(read('admin/class-routine.html'),{runScripts:'outside-only',url:'http://localhost/admin/class-routine.html'}),w=dom.window,$=id=>w.document.getElementById(id);
 w.eval(read('assets/class-routine-data.js'));const data=w.GEO_CLASS_ROUTINE_DATA;
 data.entries=[{id:'a',day:'Sunday',period:0,level:'Honours 1st Year',teacherCodes:['AM'],room:'408'},{id:'b',day:'Sunday',period:1,level:'Honours 2nd Year',teacherCodes:['AM'],room:'408'},{id:'c',day:'Sunday',period:2,level:'Honours 1st Year',teacherCodes:['SR','ZR'],room:'408'},{id:'d',day:'Monday',period:0,level:'Degree 1st Year',teacherCodes:['AM'],room:'409'}];
 let students=[{Roll:'01',CurrentYear:'Hons 1st Year',SessionYear:'2024-25'},{Roll:'02',CurrentYear:'Honours 1st Year',SessionYear:'2023-24',StudySessionYear:'2024-25'},{Roll:'03',CurrentYear:'1st Year',SessionYear:'2023-24'},{Roll:'04',CurrentYear:'Honours 1st Year',SessionYear:'2024-25',Status:'Inactive'},{Roll:'05',CurrentYear:'Degree 1st Year',SessionYear:'2024-25'},{Roll:'06',CurrentYear:'2nd Year',SessionYear:'2023-24'}];
 students.push({...students[0]});let fail=false,calls=0,gate=null;
 w.geoApiGet=async(action,params)=>{calls++;assert.equal(action,'getStudents');assert.equal(params.forceFresh,'1');if(gate)await gate;if(fail)throw Error('permission denied');return {success:true,students};};
 w.eval(read('assets/class-report.js'));const report=w.GeoClassReport;report.setData(data);
 const change=id=>$(id).dispatchEvent(new w.Event('change'));
 $('daily-date').value='2026-11-15';change('daily-date');await $('daily-load').onclick();
 assert.equal($('daily-preview').querySelectorAll('tbody tr').length,4,'Shared teachers each have a signature row');
 assert($('daily-print').disabled,'Multiple sessions require explicit choice');
 const session=()=>[...$('daily-sessions').querySelectorAll('select')].find(s=>s.dataset.level==='Honours 1st Year');
 assert.equal(session().value,'');assert.equal(session().options.length,3);
 session().value='2024-25';session().dispatchEvent(new w.Event('change'));assert(!$('daily-print').disabled);
 let trs=['a|AM','b|AM','c|SR','c|ZR'].map(key=>$('daily-preview').querySelector('[data-report-row="'+key+'"]')); assert.equal(trs[0].cells[2].textContent,'২','Deduplicated active current-study-session roster');
 assert.equal(trs[0].cells[0].rowSpan,2,'Same teacher merged over consecutive class rows');
 let input=trs[0].querySelector('input');input.value='০';input.dispatchEvent(new w.Event('input'));
 assert.equal(trs[0].cells[4].textContent,'২');assert(!$('daily-print').disabled);
 input.value='3';input.dispatchEvent(new w.Event('input'));assert($('daily-print').disabled);assert.equal(report.prepare(),null);
 input.value='1.5';input.dispatchEvent(new w.Event('input'));assert($('daily-print').disabled);
 input.value='১';input.dispatchEvent(new w.Event('input'));assert(!$('daily-print').disabled);assert.equal(trs[0].cells[4].textContent,'১');
 let root=report.prepare();assert(root.textContent.includes('১৫/১১/২০২৬'));assert(root.textContent.includes('দৈনিক ক্লাস প্রতিবেদন'));
 assert.equal(root.querySelectorAll('tbody tr').length,14);assert.equal(root.querySelectorAll('input').length,0);
 assert.equal(root.querySelector('[data-report-row="a|AM"]').cells[3].textContent,'১');
 // Blank attendance remains blank, never fabricated as everyone present/absent.
 assert.equal(root.querySelector('[data-report-row="b|AM"]').querySelectorAll('td')[2].textContent,'');
 session().value='2023-24';session().dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelector('#daily-preview input').value,'');
 // Changing filters invalidates stale tables/print. Degree and Honours are distinct cohorts.
 $('daily-date').value='2026-11-16';change('daily-date');assert($('daily-print').disabled);assert.equal($('daily-preview').children.length,0);
 const beforeDegree=calls;await $('daily-load').onclick();assert(!$('daily-print').disabled);assert.equal(w.document.querySelector('#daily-preview tbody tr').cells[2].textContent,'');assert.equal(calls,beforeDegree,'Degree-only report does not require a student query');
 $('daily-date').value='2026-11-20';change('daily-date');const before=calls;await $('daily-load').onclick();assert.equal(calls,before);assert.match($('daily-status').textContent,/কোনো ক্লাস নেই/);
 $('daily-date').value='2026-11-01';change('daily-date');await $('daily-load').onclick();assert.match($('daily-status').textContent,/কার্যকর হওয়ার আগের/);
 $('daily-date').value='2026-11-15';change('daily-date');fail=true;await $('daily-load').onclick();assert($('daily-print').disabled);assert.match($('daily-status').textContent,/অনুমতি/);fail=false;
 let release;gate=new Promise(r=>release=r);const pending=$('daily-load').onclick();$('daily-date').value='2026-11-16';change('daily-date');release();await pending;gate=null;
 assert.equal($('daily-preview').children.length,0,'Old in-flight response cannot populate new date');
 // External classes remain in mixed reports but require neither students nor sessions.
 data.entries.push({id:'xi',day:'Sunday',period:3,level:'XI',teacherCodes:['AM'],room:'801'},{id:'xii',day:'Sunday',period:4,level:'XII',teacherCodes:['AM'],room:'802'},{id:'degree',day:'Sunday',period:5,level:'Degree 2nd Year',teacherCodes:['SR'],room:'407'});
 report.setData(data);$('daily-date').value='2026-11-15';change('daily-date');await $('daily-load').onclick();
 assert($('daily-print').disabled,'Department sessions must still be selected');
 assert.equal($('daily-sessions').querySelectorAll('select').length,2,'Only department years have session controls');
 session().value='2024-25';session().dispatchEvent(new w.Event('change'));
 assert(!$('daily-print').disabled,'External missing records must not lock a mixed report');
 root=report.prepare();assert(root);assert(!root.textContent.includes('Session not selected'));
 for(const key of ['xi|AM','xii|AM','degree|SR']){
   const cells=[...root.querySelector('[data-report-row="'+key+'"]').cells];
   assert(cells.slice(-4).every(cell=>cell.textContent===''),'Unknown external counts/attendance/signature stay blank, not zero');
 }
 const beforeExternal=calls;fail=true;
 for(const level of ['XI','XII','Degree 2nd Year']){
   $('daily-level').value=level;change('daily-level');await $('daily-load').onclick();
   assert(!$('daily-print').disabled);assert.equal($('daily-sessions').children.length,0);assert(report.prepare());
 }
 assert.equal(calls,beforeExternal,'External-only reports work without the student endpoint');fail=false;
 // Count all returned database rows, including above the Supabase default page size.
 students=Array.from({length:1205},(_,i)=>({Roll:String(i+1),CurrentYear:'Honours 1st Year',StudySessionYear:'2025-26'}));
 $('daily-date').value='2026-11-15';$('daily-level').value='Honours 1st Year';$('daily-teacher').value='AM';change('daily-date');await $('daily-load').onclick();
 assert.equal(w.document.querySelector('#daily-preview tbody tr').cells[2].textContent,'১২০৫');assert(!$('daily-print').disabled);
 assert.throws(()=>report.dateDay('2026-02-31'),/তারিখ/);
 assert.notEqual(report.levelKey('Honours 1st Year'),report.levelKey('Degree 1st Year'));
 assert.notEqual(report.levelKey('HSC 1st Year'),report.levelKey('Honours 1st Year'));
 assert.equal(report.levelKey('HSC 1st Year'),report.levelKey('XI'));
 assert.equal(report.levelKey('Class 12'),report.levelKey('XII'));
 // Optional static fixture uses the production print DOM and CSS for independent PDF rendering.
 if(process.argv.includes('--fixture')){
   root=report.prepare();root.querySelector('.daily-paper-content').style.transform='none';
   fs.mkdirSync('scratch/class-report',{recursive:true});fs.writeFileSync('scratch/class-report/portrait.html','<!doctype html><html lang="bn"><meta charset="utf-8"><style>'+read('assets/class-report.css')+'</style><body class="daily-report-printing">'+root.outerHTML+'</body></html>');
 }
 dom.window.close();console.log('PASS: daily date selection, active roster/session totals, duplicate exclusion, session gate, attendance validation, print layout structure, empty/error states and stale request protection.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
