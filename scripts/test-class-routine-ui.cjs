// Offline interaction tests; no live database writes or credentials.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('../scratch/routine-check/node_modules/jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function setup(preview=false,instant='2026-11-15T03:15:00Z'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(read('student/class-routine.html'),{url:'http://localhost/student/class-routine.html',runScripts:'outside-only',virtualConsole:vc});
 const w=dom.window,d=w.document,$=id=>d.getElementById(id),RealDate=w.Date;
 w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[instant]));}};
 let prints=0,download;
 w.Blob=Blob;w.URL.createObjectURL=blob=>{download=blob;return 'blob:test';};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){};w.print=()=>prints++;
 w.GEO_ROUTINE_ADMIN_PREVIEW=preview;
 w.eval(read('assets/class-routine-data.js'));
 w.eval(read('assets/class-routine-checks.js'));
 w.eval(read('assets/class-routine-subjects.js'));
 if(!preview)w.GeoRoutineChecks.analyze=()=>{throw new Error('Public UI must not run diagnostics');};
 w.eval(read('assets/class-routine-format.js'));w.eval(read('assets/class-routine-print.js'));w.eval(read('assets/class-routine.js'));
 const choose=(key,value)=>{$('routine-'+key).value=value;$('routine-'+key).dispatchEvent(new w.Event('change'));};
 return {w,d,$,dom,errors,choose,setTime:value=>{instant=value;w.dispatchEvent(new w.Event('pageshow'));},data:w.GEO_CLASS_ROUTINE_DATA,load:()=>$('load-view').click(),count:()=>d.querySelectorAll('#routine-grid .class-entry').length,download:()=>download,prints:()=>prints};
}
async function main(){
 const pdfPanel=setup();
 try{
   const calls=[];let finish;
   pdfPanel.w.GeoRoutinePDF={download:section=>{calls.push(section);return new Promise(resolve=>{finish=resolve;});}};
   pdfPanel.$('download-routine').click();
   assert(pdfPanel.$('download-routine').disabled);
   assert(pdfPanel.$('routine-level').disabled);
   assert.deepEqual(calls,['routine']);
   finish();await new Promise(resolve=>setImmediate(resolve));
   assert(!pdfPanel.$('download-routine').disabled);
   assert(!pdfPanel.$('routine-level').disabled);
   pdfPanel.w.GeoRoutinePDF.download=async()=>{throw new Error('পরীক্ষামূলক PDF সমস্যা');};
   pdfPanel.$('download-courses').click();await new Promise(resolve=>setImmediate(resolve));
   assert.match(pdfPanel.$('routine-export-status').textContent,/পরীক্ষামূলক PDF সমস্যা/);
   assert(!pdfPanel.$('download-courses').disabled,'Export failures must allow retry');
 }finally{pdfPanel.dom.window.close();}
 const t=setup(),{w,d,$,data,choose}=t;
 try{
 assert(!$('routine-panel').hidden&&!$('courses-panel').hidden);assert.equal(t.count(),95);
 assert.equal(d.querySelectorAll('#course-groups tbody tr').length,31);
 assert($('today-dashboard').compareDocumentPosition(d.querySelector('.filter-panel'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.equal($('day-classes').closest('details'),null,'Today cards must be visible without expanding a section');
 assert($('day-classes').classList.contains('today-cards'));
 const todayPeriods=data.periods.filter(p=>data.entries.some(e=>e.day==='Sunday'&&e.period===p.id)).sort((a,b)=>a.start.localeCompare(b.start));
 assert.deepEqual(Array.from($('day-classes').querySelectorAll('.today-period'),el=>el.dataset.period),Array.from(todayPeriods,p=>String(p.id)));
 assert.equal($('day-classes').querySelectorAll('.class-entry').length,data.entries.filter(e=>e.day==='Sunday').length);
 assert.equal($('day-classes').querySelector('.today-period').dataset.status,'ongoing');
 assert.match($('now-classes').textContent,/Time remaining00:30:0045 minute class/);
 assert.equal($('now-classes').querySelector('progress').value,900);
 assert.match($('next-classes').textContent,/Today · 09:45–10:30/);
 assert.match($('next-classes').textContent,/Starts in00:30:00/);
 const timer=$('now-classes').querySelector('[data-countdown-to]'),card=$('now-classes').querySelector('.live-class-card');
 t.setTime('2026-11-15T03:15:01Z');assert.equal(timer.textContent,'00:29:59');assert.equal($('now-classes').querySelector('.live-class-card'),card,'Seconds must not rebuild class cards');assert.equal($('now-classes').querySelector('progress').value,901);assert.match($('routine-clock').textContent,/09:15:01/);
 t.setTime('2026-11-15T03:45:00Z');assert.equal($('now-classes').querySelector('[data-countdown-to]').textContent,'00:45:00');assert.equal($('now-classes').querySelector('progress').value,0);
 assert.equal($('day-classes').querySelector('.today-period').dataset.status,'completed');
 assert.equal($('day-classes').querySelectorAll('[data-status="ongoing"]').length,1);
 t.setTime('2026-11-15T03:15:00Z');
 $('print-courses').click();assert.equal(d.querySelector('#routine-print-root h1').textContent,'Course Distribution');
 w.dispatchEvent(new w.Event('afterprint'));
 assert.equal($('load-view').closest('details'),$('view-filter-options'));
 assert(!$('view-filter-options').open,'Filters start collapsed');
 d.querySelector('[data-student-view="courses"]').click();assert.equal($('routine-view').value,'courses');assert(!$('courses-panel').hidden);assert($('routine-panel').hidden);
 d.querySelector('[data-student-view="routine"]').click();assert.equal($('routine-view').value,'routine');assert(!$('routine-panel').hidden);
 assert(!$('today-dashboard').hidden);assert.match($('routine-clock').textContent,/Sunday.*09:15/);
 assert.equal(d.querySelectorAll('#now-classes .class-entry').length,data.entries.filter(e=>e.day==='Sunday'&&e.period===data.periods[0].id).length);
 assert.equal(d.querySelector('#teacher-directory'),null);assert.equal(d.querySelector('.source-panel'),null);
 w.GeoRoutinePrint.print('routine');assert.equal(t.prints(),2);
 choose('level','Honours 1st Year');assert.equal(t.count(),0);t.load();assert.equal(t.count(),20);
 assert(d.querySelector('#routine-grid .entry-level').textContent,'Teacher/year assignment supplies an automatic course');
 assert.match($('routine-grid').textContent,/Mohammad Ziaur Rahman/);
 const mapped=data.entries.find(e=>e.level==='Honours 1st Year');const course=data.courses.find(c=>c.level===mapped.level);
 mapped.courseId=course.id;t.load();assert.equal(d.querySelector('#routine-grid .entry-level').textContent,course.title);
 assert(!$('routine-panel').hidden&&$('courses-panel').hidden);
 assert($('routine-panel').classList.contains('routine-filtered'));
 assert.equal(d.querySelectorAll('.routine-issue,.routine-issue-note,.review-label,.course-note,.entry-note').length,0);
 assert($('teacher-conflicts').hidden);
 $('print-routine').click();assert.equal(t.prints(),3);assert(!d.querySelector('.rp-teachers'));assert(!d.querySelector('.rp-issue-notes'));
 w.dispatchEvent(new w.Event('afterprint'));
 choose('teacher','SR');assert($('routine-panel').hidden);assert.equal(t.count(),0);assert($('print-routine').disabled);
 t.load();assert.equal(t.count(),data.entries.filter(e=>e.level==='Honours 1st Year'&&e.teacherCodes.includes('SR')).length);
 choose('view','courses');assert($('routine-day-label').hidden);assert($('routine-panel').hidden&&$('courses-panel').hidden);
 t.load();assert(!$('courses-panel').hidden&&$('routine-panel').hidden);assert.equal(d.querySelectorAll('#course-groups tbody tr').length,1);
 $('print-courses').click();assert(!d.querySelector('.rp-teachers'));assert.equal(d.querySelector('#routine-print-root h1').textContent,'Course Distribution');
 w.dispatchEvent(new w.Event('afterprint'));
 $('reset-filters').click();choose('view','routine');t.load();assert.equal(t.count(),95);
 $('print-routine').click();assert.equal(d.querySelectorAll('.rp-teachers tbody tr').length,4);assert(!d.querySelector('.rp-issue-notes'));
 w.dispatchEvent(new w.Event('afterprint'));
 for(const teacher of data.teachers){choose('teacher',teacher.code);t.load();assert.equal(t.count(),data.entries.filter(e=>e.teacherCodes.includes(teacher.code)).length);}
 choose('teacher','SR');choose('level','Honours 2nd Year');choose('day','Tuesday');t.load();assert.equal(t.count(),1);assert.match($('routine-grid').textContent,/Practical/);
 choose('teacher','AM');choose('level','Degree 2nd Year');t.load();assert.equal(t.count(),0);assert(!$('routine-empty').hidden);assert($('print-routine').disabled);
 $('reset-filters').click();t.load();$('export-routine').click();const csv=await t.download().text();assert.equal(csv.split('\r\n').length,96);assert(!csv.includes('Needs confirmation'));assert(!csv.includes('Source text'));
 assert(!/[\u0980-\u09ff]/.test(csv),'Student routine CSV uses English display text');
 assert(!/[\u0980-\u09ff]/.test(d.body.textContent),'Student routine interface contains no Bangla text');
 assert.match($('routine-grid').textContent,/H₁-Ban/,'The full timetable uses the Bangla subject symbol');
 assert.deepEqual(Array.from(new Uint8Array(await t.download().arrayBuffer()).slice(0,3)),[239,187,191]);
 data.courses[0].title='=HYPERLINK("https://example.invalid")';data.entries[0].subject='<img src=x onerror=alert(1)>';
 t.load();assert(!d.querySelector('#routine-grid img'));choose('view','courses');t.load();$('export-courses').click();assert((await t.download().text()).includes('"\'=HYPERLINK'));assert(!d.querySelector('.course-note'));
 $('today-classes').click();assert.equal($('routine-view').value,'routine');assert.equal($('routine-day').value,'Sunday');assert.equal(t.count(),data.entries.filter(e=>e.day==='Sunday').length);
 $('back-to-today').click();assert(!$('today-dashboard').hidden);assert($('routine-panel').hidden);
 $('load-full-routine').click();assert.equal(t.count(),95);assert(!$('routine-panel').classList.contains('routine-filtered'));assert.equal($('routine-level').value,'');
 assert.equal(t.errors.length,0,t.errors.join('\n'));
 }finally{t.dom.window.close();}
 for(const [instant,day,period] of [['2026-11-15T03:45:00Z','Sunday',1],['2026-11-15T06:15:00Z','Sunday',null],['2026-11-20T03:00:00Z','Friday',null],['2026-11-14T18:01:00Z','Sunday',null]]){
 const x=setup(false,instant);try{assert.equal(x.d.querySelectorAll('#now-classes .class-entry').length,period===null?0:x.data.entries.filter(e=>e.day===day&&e.period===x.data.periods[period].id).length);assert(x.$('routine-clock').textContent.includes(day));assert.equal(x.errors.length,0);}finally{x.dom.window.close();}}
 const nonMajorCards=setup(false,'2026-11-16T06:45:00Z');try{
   const entry=nonMajorCards.data.entries.find(e=>e.day==='Monday'&&e.subject==='Non-major: Social Work');
   assert(entry);
   const course={id:'social-work-card-test',level:entry.level,code:'222115',title:'Bangladesh Society and Culture',subjectType:'Non-major',teacherCodes:[]};
   nonMajorCards.data.courses.push(course);entry.courseId=course.id;entry.room='405';
   nonMajorCards.setTime('2026-11-16T06:46:00Z');
   for(const section of ['next-classes','day-classes']){
     const card=nonMajorCards.$(section).querySelector('[data-entry-id="'+entry.id+'"]');
     assert.equal(card.querySelector('.live-subject').textContent,course.title);
     assert.equal(card.querySelector('.live-course-code').textContent,'Code: 222115');
     assert.equal(card.querySelector('.live-room').textContent,'Room 405');
   }
   nonMajorCards.setTime('2026-11-16T07:20:00Z');
   assert.equal(nonMajorCards.$('now-classes').querySelector('[data-entry-id="'+entry.id+'"] .live-room').textContent,'Room 405');
   entry.courseId='';nonMajorCards.setTime('2026-11-16T07:21:00Z');
   const fallback=nonMajorCards.$('now-classes').querySelector('[data-entry-id="'+entry.id+'"]');
   assert.equal(fallback.querySelector('.live-subject').textContent,'Social Work');assert(!fallback.querySelector('.live-course-code'));
 }finally{nonMajorCards.dom.window.close();}
 const future=setup(false,'2026-11-08T03:00:00Z');try{assert.equal(future.d.querySelectorAll('#now-classes .class-entry,#day-classes .class-entry').length,0);assert.match(future.$('now-classes').textContent,/takes effect/);assert.match(future.$('next-classes').textContent,/Thursday · 12 Nov/);}finally{future.dom.window.close();}
 const breakView=setup(false,'2026-11-15T06:00:00Z');try{
   assert(breakView.$('now-classes').querySelector('.snack-break'));
   assert.match(breakView.$('now-classes').textContent,/Break ends in00:30:00/);
   const scene=breakView.$('now-classes').querySelector('.snack-scene');
   breakView.setTime('2026-11-15T06:00:01Z');
   assert.equal(breakView.$('now-classes').querySelector('.snack-scene'),scene);
   assert.match(breakView.$('now-classes').textContent,/00:29:59/);
   breakView.setTime('2026-11-15T06:30:00Z');
   assert(!breakView.$('now-classes').querySelector('.snack-break'));
   assert(breakView.$('now-classes').querySelector('.class-entry'));
   breakView.setTime('2026-11-20T06:15:00Z');
   assert(!breakView.$('now-classes').querySelector('.snack-break'),'No break animation on a day without classes');
 }finally{breakView.dom.window.close();}
 for(const [instant,expected] of [['2026-11-15T03:45:00Z','Today · 10:30'],['2026-11-15T06:15:00Z','Today · 12:30'],['2026-11-15T09:00:00Z','Tomorrow · 09:00'],['2026-11-20T03:00:00Z','Sunday · 22 Nov']]){
   const x=setup(false,instant);try{assert(x.$('next-classes').textContent.includes(expected),x.$('next-classes').textContent);}finally{x.dom.window.close();}
 }
 const visibility=setup();try{
   const c=visibility.data.courses[0];c.showInDistribution=false;
   visibility.choose('view','courses');visibility.load();
   assert.equal(visibility.d.querySelectorAll('#course-groups tbody tr').length,30);
   visibility.$('print-courses').click();assert(!visibility.d.querySelector('[data-course-id="'+c.id+'"]'));
   visibility.w.dispatchEvent(new visibility.w.Event('afterprint'));
   visibility.$('export-courses').click();assert.equal((await visibility.download().text()).split('\r\n').length,31);
   const slot=visibility.data.entries.find(e=>e.level===c.level);slot.courseId=c.id;
   assert.equal(visibility.w.GeoRoutinePrint.courseName(visibility.data,slot),c.title,'Hidden distribution courses remain available in routine slots');
 }finally{visibility.dom.window.close();}
 const admin=setup(true);try{
   assert.equal(admin.count(),95);assert(admin.$('today-dashboard').hidden);assert(admin.d.querySelector('.routine-issue-note'));
   for(const entry of admin.data.entries){
     const item=admin.d.querySelector('#routine-grid [data-entry-id="'+entry.id+'"]');
     if(!admin.w.GeoRoutineChecks.checksEnabled(admin.data,entry))assert(!item.querySelector('.entry-note,.review-label,.routine-issue-note')&&!item.classList.contains('routine-issue'));
     if(admin.w.GeoRoutineChecks.isNonMajor(admin.data,entry))assert.equal(item.textContent,admin.w.GeoRoutineFormat.fullEntry(admin.data,entry));
   }
   admin.$('print-routine').click();
   for(const entry of admin.data.entries)assert.equal(admin.d.querySelector('#routine-print-root [data-entry-id="'+entry.id+'"]').textContent,admin.w.GeoRoutineFormat.fullEntry(admin.data,entry));
   admin.w.dispatchEvent(new admin.w.Event('afterprint'));
   admin.choose('teacher','SR');assert.equal(admin.count(),30);admin.$('print-routine').click();
   assert(!admin.d.querySelector('#routine-print-root .rp-issue-notes,#routine-print-root .rp-issue,#routine-print-root .rp-draft'));
   assert(!admin.d.querySelector('.rp-teachers'));assert.equal(admin.errors.length,0);
 }finally{admin.dom.window.close();}
 // Exercise actual panel print buttons with identical documents and selections.
 const student=setup(false),preview=setup(true);
 try{
   for(const selection of [{},{level:'Honours 1st Year'},{level:'Honours 4th Year'},{teacher:'SR'},{day:'Thursday'},{level:'Honours 4th Year',teacher:'RS'},{view:'courses'},{view:'courses',teacher:'SR'}]){
     for(const panel of [student,preview]){
       panel.$('reset-filters').click();
       panel.choose('view',selection.view||'routine');
       for(const key of ['level','teacher','day'])panel.choose(key,selection[key]||'');
       if(panel===student)panel.load();
       panel.$(selection.view==='courses'?'print-courses':'print-routine').click();
     }
     assert.equal(preview.d.getElementById('routine-print-root').outerHTML,student.d.getElementById('routine-print-root').outerHTML,JSON.stringify(selection));
     assert.equal(preview.d.getElementById('routine-page-size').textContent,student.d.getElementById('routine-page-size').textContent);
     for(const panel of [student,preview])panel.w.dispatchEvent(new panel.w.Event('afterprint'));
   }
   assert.equal(student.errors.length+preview.errors.length,0);
 }finally{student.dom.window.close();preview.dom.window.close();}
 console.log('PASS: explicit loading, student screen/CSV/print without diagnostics, full-only legend, admin warnings, Dhaka today/now boundaries and CSV safety.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
