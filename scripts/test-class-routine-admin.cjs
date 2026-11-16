// Offline DOM tests, with fake storage. No live database mutations.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
 const dom=new JSDOM(read('admin/class-routine.html'),{url:'http://localhost:3003/admin/class-routine.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document,$=id=>d.getElementById(id);
 w.requireAuth=()=>({role:'admin'});w.attachLogout=()=>{};w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.eval(read('assets/class-routine-data.js'));
 // Load dependencies in actual HTML order, so missing script tags cannot be masked by the test.
 const scripts=[...d.scripts].map(s=>new URL(s.src).pathname.replace(/^\//,''));
 const checker=scripts.indexOf('assets/class-routine-checks.js'),controller=scripts.indexOf('assets/class-routine-admin.js');
 assert(checker>=0&&checker<controller,'Admin HTML must load the checker before the controller');
 for(const file of scripts.slice(0,controller))if(/(class-routine-(checks|store|subjects|format)|class-report)\.js$/.test(file))w.eval(read(file));
 const store=w.GeoRoutineStore,clone=store.clone;
 let draft={document:clone(w.GEO_CLASS_ROUTINE_DATA),revision:1},live=clone(draft),saveError=false,saves=0,saveCalls=0,saveGate=null;
 store.draft=async()=>clone(draft);store.published=async()=>clone(live);
 store.save=async(doc,revision)=>{saveCalls++;if(saveGate)await saveGate;if(saveError)throw new Error('Draft changed. Reload');assert.equal(revision,draft.revision);saves++;draft={document:clone(doc),revision:revision+1};return clone(draft);};
 store.publish=async revision=>{assert.equal(revision,draft.revision);live=clone(draft);return clone(live);};
 w.eval(read('assets/class-routine-admin.js'));await tick();
 assert.equal($('class-rows').children.length,95);assert.equal($('course-rows').children.length,31);
 // Report counts actual routine entries, not course allocations; filters reuse the editor scope.
 const reportStart=JSON.stringify(draft);
 d.querySelector('[data-routine-view="report"]').click();
 assert(!$('manage-report').hidden&&$('manage-classes').hidden);
 assert.equal($('report-total').textContent,'95');assert.equal($('report-levels').textContent,'10');
 assert.match($('report-source').textContent,/Saved draft/);
 assert.equal(Number($('report-unassigned').textContent),draft.document.entries.filter(e=>!e.teacherCodes.length).length);
 const dayValues=[...$('report-day-table').querySelectorAll('tbody td')].map(td=>Number(td.textContent));
 assert.deepEqual(dayValues,[...draft.document.days.map(day=>draft.document.entries.filter(e=>e.day===day).length),95]);
 for(const teacher of draft.document.teachers){
   const row=[...$('report-teacher-table').querySelectorAll('tbody tr')].find(tr=>tr.firstElementChild.textContent===teacher.name+' ('+teacher.code+')');
   assert.equal(Number(row.lastElementChild.textContent),draft.document.entries.filter(e=>e.teacherCodes.includes(teacher.code)).length);
 }
 $('edit-level').value='Honours 1st Year';$('edit-day').value='Monday';$('edit-period').value='0';$('edit-teacher').value='AM';$('edit-period').onchange();
 assert.equal($('report-total').textContent,'1');assert.equal($('report-teacher-table').querySelectorAll('tbody tr').length,1);
 $('editor-search').value='impossible-filter';$('editor-search').dispatchEvent(new w.Event('input'));
 assert.equal($('report-total').textContent,'0');assert.match($('report-teacher-table').textContent,/No classes match/);
 assert.equal(JSON.stringify(draft),reportStart);assert.equal(saveCalls,0,'Reading/filtering reports must not write data');
 $('clear-editor-filters').click();d.querySelector('[data-routine-view="classes"]').click();
 assert.equal($('class-board').querySelectorAll('.editor-class-card').length,95);assert($('class-table').hidden);
 for(const entry of draft.document.entries){
   const card=$('class-board').querySelector('[data-entry-id="'+entry.id+'"]');
   if(!w.GeoRoutineChecks.checksEnabled(draft.document,entry))assert(!card.classList.contains('routine-issue'));
   if(w.GeoRoutineChecks.isNonMajor(draft.document,entry)){
     assert.equal(card.querySelector('b').textContent,w.GeoRoutineChecks.nonMajorName(draft.document,entry));
     assert(!card.textContent.includes('Room ')&&!card.textContent.includes('Not specified'));
   }
 }
 $('editor-search').value='Oceanography';$('editor-search').dispatchEvent(new w.Event('input'));assert.equal($('class-board').querySelectorAll('.editor-class-card').length,1);
 $('editor-search').value='407';$('editor-search').dispatchEvent(new w.Event('input'));assert.equal($('class-board').querySelectorAll('.editor-class-card').length,draft.document.entries.filter(e=>e.room==='407').length);
 $('class-board').querySelector('.editor-class-card').click();assert($('row-dialog').open);assert.equal($('row-room').value,'407');assert($('row-context').textContent.includes('Sunday'));$('row-dialog').close();
 $('clear-editor-filters').click();d.querySelector('[data-editor-layout="table"]').click();assert(!$('class-table').hidden&&$('class-board').hidden);
 d.querySelector('[data-editor-layout="board"]').click();assert(!$('class-board').hidden);
 $('class-board').querySelector('[aria-label="Add class on Thursday"]').click();assert.equal($('row-day').value,'Thursday');$('row-dialog').close();
 assert.equal($('manage-classes').hidden,false);assert.equal($('manage-courses').hidden,true);
 $('edit-day').value='Tuesday';$('edit-day').onchange();assert.equal($('class-rows').children.length,20);
 $('edit-level').value='Honours 2nd Year';$('edit-level').onchange();$('new-class').click();assert.equal($('row-day').value,'Tuesday');assert.equal($('row-level').value,'Honours 2nd Year');
 assert.equal($('row-teacher-options').querySelectorAll('input[type=checkbox]').length,4);$('row-dialog').close();
 d.querySelector('[data-routine-view="courses"]').click();assert.equal($('manage-classes').hidden,true);assert.equal($('manage-courses').hidden,false);assert.equal($('edit-day-label').hidden,true);assert.equal($('course-rows').children.length,4);
 $('clear-editor-filters').click();d.querySelector('[data-routine-view="classes"]').click();assert.equal($('class-rows').children.length,95);
 assert.ok($('publish-draft').disabled);assert.ok($('save-draft').disabled);
 $('class-rows').querySelector('button').click();$('row-room').value='409';await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 assert.equal($('row-error').textContent,'');assert.equal(live.document.entries[0].room,'407');assert.ok($('save-draft').disabled);
 assert.equal(draft.document.entries[0].room,'409');assert.equal(live.document.entries[0].room,'407');assert.ok($('publish-draft').disabled);
 $('preview-draft').click();assert.ok($('publish-draft').disabled);
 const frame=$('draft-preview').contentWindow;
 w.dispatchEvent(new w.MessageEvent('message',{origin:'https://untrusted.invalid',source:frame,data:{type:'geo-routine-preview-rendered'}}));assert.ok($('publish-draft').disabled);
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:frame,data:{type:'geo-routine-preview-rendered'}}));assert.ok(!$('publish-draft').disabled);
 $('preview-dialog').close();await $('publish-draft').onclick();assert.equal(live.document.entries[0].room,'409');assert.ok($('publish-draft').disabled);
 // A single course saves directly to draft; publication remains separate.
 $('new-course').click();assert($('row-distribution-visible').checked);$('row-distribution-visible').checked=false;$('row-code').value='999999';$('row-detail').value='New course';await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 assert.equal(draft.document.courses.find(c=>c.code==='999999').showInDistribution,false);
 assert.equal($('course-rows').children.length,32);assert.equal(draft.document.courses.length,32);assert.equal(live.document.courses.length,31);
 $('admin-teachers').querySelector('button').click();$('teacher-code').value='RS2';$('teacher-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal($('teacher-error').textContent,'');
 await $('save-draft').onclick();assert.equal(draft.document.courses.length,32);assert.ok(draft.document.entries.some(r=>r.teacherCodes.includes('RS2')));assert.ok(!draft.document.entries.some(r=>r.teacherCodes.includes('RS')));
 // Settings cannot silently be omitted from a save or overwritten by another editor.
 assert($('effective').readOnly);$('distribution').value='2026-12-01';$('distribution').dispatchEvent(new w.Event('input',{bubbles:true}));assert.ok($('preview-draft').disabled);assert.ok($('save-draft').disabled);
 $('settings-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.ok(!$('save-draft').disabled);
 saveError=true;await $('save-draft').onclick();assert.match($('admin-status').textContent,/খসড়া পরিবর্তন/);assert.match($('dirty-state').textContent,/Unsaved/);assert.ok(!$('save-draft').disabled);
 saveError=false;await $('save-draft').onclick();assert.equal(draft.document.distributionDate,'2026-12-01');assert.equal(draft.document.effectiveDate,store.effectiveDateToday());assert.equal(live.document.distributionDate,'2026-11-11');assert.equal(saves,4);
 const invalid=clone(draft.document);invalid.periods[0].start='08:99';assert.throws(()=>store.validate(invalid),/ক্লাসের সময়/);
 invalid.periods[0].start='09:00';invalid.effectiveDate='2026-02-31';assert.throws(()=>store.validate(invalid),/তারিখ/);
 // Assign a real slot explicitly; unrelated edits retain it and changing level clears it.
 $('edit-level').value='Honours 4th Year';$('edit-level').onchange();
 $('class-rows').querySelector('button').click();
 const course=draft.document.courses.find(c=>c.level==='Honours 4th Year');
 assert.equal($('row-course').value,'');
 assert([...$('row-course').options].filter(o=>o.value).every(o=>draft.document.courses.find(c=>c.id===o.value).level==='Honours 4th Year'));
 $('row-course').value=course.id;await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 await $('save-draft').onclick();
 const assigned=draft.document.entries.find(e=>e.courseId===course.id);assert(assigned);assert(!live.document.entries.some(e=>e.courseId===course.id));
 $('class-rows').querySelector('button').click();assert.equal($('row-course').value,course.id);
 $('row-room').value='409';await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));await $('save-draft').onclick();
 assert.equal(draft.document.entries.find(e=>e.id===assigned.id).courseId,course.id);
 $('class-rows').querySelector('button').click();$('row-level').value='Honours 1st Year';$('row-level').dispatchEvent(new w.Event('change'));assert.equal($('row-course').value,'');$('row-dialog').close();
 // All same-level courses are visible without opening a select; teacher matches are prioritized,
 // but no course or teacher assignment is guessed automatically.
 $('clear-editor-filters').click();
 const amEntry=draft.document.entries.find(e=>e.level==='Honours 1st Year'&&e.day==='Monday'&&e.teacherCodes.includes('AM'));
 $('class-board').querySelector(`[data-entry-id="${amEntry.id}"]`).click();
 assert.equal($('row-course').value,'');
 const firstYear=draft.document.courses.filter(c=>c.level==='Honours 1st Year');
 assert.equal($('course-choices').children.length,firstYear.length);
 const matchedCourse=firstYear.find(c=>c.teacherCodes.includes('AM'));
 assert.equal($('course-choices').firstElementChild.dataset.courseId,matchedCourse.id);
 $('course-choices').firstElementChild.click();assert.equal($('row-course').value,matchedCourse.id);
 assert($('selected-course').textContent.includes(matchedCourse.title));
 assert.equal($('course-choices').querySelectorAll('[aria-pressed="true"]').length,1);
 await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 assert.equal(draft.document.entries.find(e=>e.id===amEntry.id).courseId,matchedCourse.id);
 assert.deepEqual(draft.document.entries.find(e=>e.id===amEntry.id).teacherCodes,amEntry.teacherCodes);
 assert($('class-board').querySelector(`[data-entry-id="${amEntry.id}"]`).textContent.includes(matchedCourse.title));
 // Day/time filters include period 0. Time-group Add preselects that time and selected day.
 $('edit-day').value='Tuesday';$('edit-day').onchange();$('edit-period').value='0';$('edit-period').onchange();
 const slotEntries=draft.document.entries.filter(e=>e.day==='Tuesday'&&e.period===0);
 assert.equal($('class-board').querySelectorAll('.editor-class-card').length,slotEntries.length);
 d.querySelector('[data-editor-layout="time"]').click();assert.equal($('class-board').querySelectorAll('.editor-day').length,1);
 $('class-board').querySelector('.editor-day-heading button').click();
 assert.equal($('row-day').value,'Tuesday');assert.equal($('row-period').value,'0');
 $('row-room').value='Test Room';
 const beforeRows=draft.document.entries.length,beforeLive=JSON.stringify(live),beforeCalls=saveCalls;
 let release;saveGate=new Promise(resolve=>{release=resolve;});
 const pending=$('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 assert($('save-row').disabled&&$('row-period').disabled&&$('publish-draft').disabled);
 assert.equal($('row-dialog').dispatchEvent(new w.Event('cancel',{cancelable:true})),false);
 await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));assert.equal(saveCalls,beforeCalls+1);
 release();await pending;saveGate=null;
 assert(!$('row-dialog').open);assert.equal(draft.document.entries.length,beforeRows+1);
 const newEntry=draft.document.entries.find(e=>e.room==='Test Room');assert(newEntry);
 assert.equal(newEntry.day,'Tuesday');assert.equal(newEntry.period,0);assert.equal(JSON.stringify(live),beforeLive);
 assert($('save-draft').disabled);await $('reload-draft').onclick();
 assert($('class-board').querySelector(`[data-entry-id="${newEntry.id}"]`),'Single entry survives reload without a separate Save draft');
 // Move an existing class to a new day/time. A failed/stale save retains all form values;
 // retry updates the existing ID exactly once, and never publishes implicitly.
 $('class-board').querySelector(`[data-entry-id="${newEntry.id}"]`).click();
 $('row-day').value='Thursday';$('row-period').value='1';$('row-room').value='Retry Room';
 const beforeFailure=JSON.stringify(draft);saveError=true;
 await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 assert($('row-dialog').open);assert.match($('row-error').textContent,/খসড়া পরিবর্তন/);
 assert.equal($('row-room').value,'Retry Room');assert.equal($('row-day').value,'Thursday');assert.equal($('row-period').value,'1');
 assert.equal(JSON.stringify(draft),beforeFailure);assert(!$('save-row').disabled);
 saveError=false;await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 assert.equal(draft.document.entries.length,beforeRows+1);const moved=draft.document.entries.find(e=>e.id===newEntry.id);
 assert.equal(moved.day,'Thursday');assert.equal(moved.period,1);assert.equal(moved.room,'Retry Room');
 assert(!$('class-board').querySelector(`[data-entry-id="${newEntry.id}"]`),'Moved entry leaves old day/time filter');
 assert.equal(JSON.stringify(live),beforeLive);assert($('publish-draft').disabled);
 // Shared teaching counts one class in the total and one for each involved teacher.
 $('clear-editor-filters').click();$('class-board').querySelector(`[data-entry-id="${newEntry.id}"]`).click();
 const teacherBoxes=[...$('row-teacher-options').querySelectorAll('input')];teacherBoxes.forEach((box,i)=>box.checked=i<2);
 await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 $('editor-search').value='Retry Room';$('editor-search').dispatchEvent(new w.Event('input'));d.querySelector('[data-routine-view="report"]').click();
 assert.equal($('report-total').textContent,'1');assert.equal($('report-teachers').textContent,'2');
 assert.equal($('report-teacher-table').querySelectorAll('tbody tr').length,2);
 assert([...$('report-teacher-table').querySelectorAll('tbody tr')].every(tr=>tr.lastElementChild.textContent==='1'));
 assert.equal($('report-level-table').querySelector('tbody tr').lastElementChild.textContent,'1');
 $('clear-editor-filters').click();assert.equal($('class-board').querySelectorAll('.editor-day').length,draft.document.periods.length);
 $('edit-period').value='0';$('edit-period').onchange();d.querySelector('[data-routine-view="courses"]').click();
 assert($('edit-period-label').hidden);assert.equal($('course-rows').children.length,draft.document.courses.length,'Time filter must not hide courses');
 const badLink=clone(draft.document);badLink.entries.find(e=>e.id===assigned.id).courseId='missing';assert.throws(()=>store.validate(badLink),/কোর্স/);
 // New year-wise Subjects can be allocated or selected directly for a class.
 w.GEO_SUPABASE_URL='https://fixture.invalid';w.GEO_SUPABASE_PUBLISHABLE_KEY='public';
 w.fetch=async()=>({ok:true,json:async()=>[
   {SubjectCode:'213999',SubjectName:'Catalogue-only major',AcademicYear:'Honours 1st Year',SubjectType:'Major',Status:'Active'},
   {SubjectCode:'213998',SubjectName:'Another catalogue course',AcademicYear:'Honours 1st Year',SubjectType:'Major',Status:'Active'}
 ]});
 await w.GeoRoutineSubjects.load(draft.document);
 $('new-course').click();$('row-level').value='Honours 1st Year';$('row-level').dispatchEvent(new w.Event('change'));
 $('row-catalog').value='213999';$('row-catalog').dispatchEvent(new w.Event('change'));
 assert.equal($('row-code').value,'213999');assert.equal($('row-detail').value,'Catalogue-only major');
 $('row-teacher-options').querySelector('input[value="AM"]').checked=true;
 await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 assert.equal(draft.document.courses.find(c=>c.code==='213999').subjectType,'Major');
 $('new-class').click();$('row-level').value='Honours 1st Year';$('row-level').dispatchEvent(new w.Event('change'));
 const virtual=[...$('row-course').options].find(o=>o.textContent.includes('213998'));assert(virtual);
 $('row-course').value=virtual.value;await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 const added=draft.document.courses.find(c=>c.code==='213998');assert(added);assert.equal(added.showInDistribution,false);assert.equal(added.teacherCodes.length,0);assert(draft.document.entries.some(e=>e.courseId===added.id));
 $('new-class').click();$('row-level').value='XI';$('row-level').dispatchEvent(new w.Event('change'));assert(!$('row-section-label').hidden);
 $('row-section').value='Humanities-C';$('row-room').value='702';await $('row-form').onsubmit(new w.Event('submit',{cancelable:true}));
 const sectionRow=draft.document.entries.at(-1);assert.equal(sectionRow.section,'Humanities-C');assert.equal(sectionRow.level,'XI');
 $('clear-editor-filters').click();d.querySelector('[data-routine-view="classes"]').click();
 $('class-board').querySelector('[data-entry-id="'+sectionRow.id+'"]').click();assert.equal($('row-section').value,'Humanities-C');
 $('row-level').value='Honours 1st Year';$('row-level').dispatchEvent(new w.Event('change'));assert($('row-section-label').hidden);$('row-dialog').close();
 w.eval(read('assets/class-routine-images.js'));
 const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1X8AAAAASUVORK5CYII=';
 const originalLive=JSON.stringify(live);
 w.GeoRoutineImages.readFile=async()=>picture;
 for(const kind of ['signature','seal']){
   Object.defineProperty($(kind+'-upload'),'files',{configurable:true,value:[new w.File(['image'],'test.png',{type:'image/png'})]});
   $(kind+'-upload').dispatchEvent(new w.Event('change'));await tick();
   assert.equal($(kind+'-preview').src,picture);assert(!$(kind+'-preview').hidden);
 }
 const previousDraft=JSON.stringify(draft);saveError=true;
 await $('save-print-assets').onclick();assert.equal(JSON.stringify(draft),previousDraft);assert(!$('signature-preview').hidden);
 saveError=false;await $('save-print-assets').onclick();assert.deepEqual(JSON.parse(JSON.stringify(draft.document.printAssets)),{signature:picture,seal:picture});
 assert.equal(JSON.stringify(live),originalLive,'Uploading/saving images must not publish them');
 await $('reload-draft').onclick();assert.equal($('seal-preview').src,picture);
 $('remove-seal').click();await $('save-print-assets').onclick();assert.equal(draft.document.printAssets.seal,undefined);
 assert.throws(()=>store.validate({...draft.document,printAssets:{signature:'https://example.invalid/image.png'}}));
 assert.throws(()=>store.validate({...draft.document,printAssets:{signature:'data:image/svg+xml;base64,PHN2Zz4='}}));
 dom.window.close();console.log('PASS: admin CRUD, direct saving/retry, draft isolation, preview gate, settings and signature/seal upload-save-remove validation.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
