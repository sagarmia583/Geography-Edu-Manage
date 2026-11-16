// Builds offline print fixtures with the same production renderer; no database access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const cases=[
 {name:'full-routine',filters:{},section:'routine'},
 {name:'class-4th-year',filters:{level:'Honours 4th Year'},section:'routine'},
 {name:'class-1st-year',filters:{level:'Honours 1st Year'},section:'routine'},
 {name:'day-sunday',filters:{day:'Sunday'},section:'routine'},
 {name:'teacher-SR',filters:{teacher:'SR'},section:'routine'},
 {name:'unassigned-teacher',filters:{teacher:'__unspecified__'},section:'routine'},
 {name:'all-courses',filters:{},section:'courses'},
 {name:'teacher-courses',filters:{teacher:'SR'},section:'courses'},
 {name:'long-content',filters:{teacher:'SR'},section:'routine',stress:true}
];
const out=path.join(root,'scratch/routine-print');fs.mkdirSync(out,{recursive:true});
for(const c of cases){
 const dom=new JSDOM('<!doctype html><html><head></head><body class="routine-page"></body></html>',{url:'http://localhost/student/class-routine.html',runScripts:'outside-only'}),w=dom.window;
 w.eval(read('assets/class-routine-data.js'));w.eval(read('assets/class-routine-checks.js'));w.eval(read('assets/class-routine-subjects.js'));w.eval(read('assets/class-routine-format.js'));w.eval(read('assets/class-routine-print.js'));
 const data=w.GEO_CLASS_ROUTINE_DATA;
 // Explicit links resolve by stable course ID; empty slots use shared rotation.
 const sample=data.entries.find(e=>e.level==='Honours 4th Year');
 const assigned=data.courses.find(c=>c.level===sample.level);
 assert(w.GeoRoutinePrint.courseName(data,sample));
 assert.equal(w.GeoRoutinePrint.courseName(data,{...sample,courseId:assigned.id}),assigned.title);
 assert.equal(w.GeoRoutinePrint.courseName(data,{...sample,courseId:'missing'}),'');
 w.GeoRoutinePrint.configure(()=>({data,entries:[{...sample,courseId:assigned.id}],courses:data.courses,filters:{level:sample.level}}));
 const assignedPrint=w.GeoRoutinePrint.prepare('routine');
 assert.equal(assignedPrint.querySelector('td[data-column="2"]').textContent,assigned.title);
 assert.equal(assignedPrint.querySelector('td[data-column="3"]').textContent,sample.teacherCodes.map(code=>data.teachers.find(t=>t.code===code).name).join(' / '));
 // Explicit fixture assignments exercise long course names without changing stored routine data.
 sample.courseId=assigned.id;
 const longSlot=data.entries.find(e=>e.level==='Honours 4th Year'&&e.id!==sample.id);
 longSlot.courseId=data.courses.filter(c=>c.level===longSlot.level).at(-1).id;
 if(c.stress)data.entries=data.entries.flatMap((e,i)=>[e,{...e,id:e.id+'-extra',subject:'Long class details to verify scaling without losing the final row, room or assigned teacher. '.repeat(3)}]);
 const match=r=>(!c.filters.level||r.level===c.filters.level)&&(!c.filters.teacher||(c.filters.teacher==='__unspecified__'?!r.teacherCodes.length:r.teacherCodes.includes(c.filters.teacher)));
 const state={data,entries:data.entries.filter(r=>match(r)&&(!c.filters.day||r.day===c.filters.day)),courses:data.courses.filter(match),filters:c.filters};
 w.GeoRoutinePrint.configure(()=>state);const printed=w.GeoRoutinePrint.prepare(c.section);
 // Panel mode must never change the printed document or its paper setup.
 const studentMarkup=printed.outerHTML,studentPageSize=w.document.getElementById('routine-page-size').textContent;
 w.GeoRoutineChecks.analyze=()=>{throw new Error('Printing must not run admin diagnostics');};
 w.document.body.classList.add('routine-draft-preview');
 w.GeoRoutinePrint.configure(()=>({...state,adminPreview:true}));
 assert.equal(w.GeoRoutinePrint.prepare(c.section).outerHTML,studentMarkup,c.name+': admin/student print parity');
 assert.equal(w.document.getElementById('routine-page-size').textContent,studentPageSize);
 w.document.body.classList.remove('routine-draft-preview');
 w.GeoRoutinePrint.configure(()=>state);
 const full=c.name==='full-routine';assert.ok(printed.classList.contains(full?'rp-landscape':'rp-portrait'));
 assert.match(w.document.getElementById('routine-page-size').textContent,new RegExp('A4 '+(full?'landscape':'portrait')));
 assert.equal(printed.querySelectorAll('[data-entry-id]').length,c.section==='routine'?state.entries.length:0);
 assert.equal(printed.querySelectorAll('[data-course-id]').length,c.section==='courses'?state.courses.length:0);
 if(full){assert.equal(printed.querySelector('.rp-break').rowSpan,5);assert.equal(printed.querySelectorAll('.rp-teachers tbody tr').length,4);assert.equal(printed.querySelectorAll('.rp-week thead th').length,9);assert.ok(!printed.textContent.includes('-SH'));}
 if(!full)assert.equal(printed.querySelector('.rp-teachers'),null,'Only the full routine includes the teacher directory');
 assert.equal(printed.querySelector('.rp-issue-notes,.rp-issue,.rp-draft'),null,'Student print must contain no admin diagnostics');
 assert(!/[\u0980-\u09ff]/.test(printed.textContent),'Published routine print uses English text');
 if(c.section==='courses'){
  assert.equal(printed.querySelector('h1').textContent,'Course Distribution');assert.equal(printed.querySelector('.rp-footer'),null);
  assert.equal(printed.querySelector('.rp-department').textContent,data.department);
  assert.equal(printed.querySelector('.rp-institution').textContent,data.institution);
  assert.equal(printed.querySelectorAll('.rp-course-group').length,new Set(state.courses.map(r=>r.level)).size);
  for(const group of printed.querySelectorAll('.rp-course-group')){
   assert.equal(group.querySelector('tbody tr td').textContent,'1.');assert.equal(group.querySelectorAll('thead').length,0);
   [...group.querySelectorAll('tbody tr')].forEach(tr=>{const source=state.courses.find(r=>r.id===tr.dataset.courseId);assert.equal(tr.cells[1].textContent,source.title);assert.equal(tr.cells[2].textContent,source.code||'');assert.equal(tr.cells[3].textContent,source.teacherCodes.length>2?source.teacherCodes[0]+',\n'+source.teacherCodes.slice(1).join(','):source.teacherCodes.join('/'));});
  }
 }else assert.ok(printed.textContent.includes('Head of the Department'));
 if(!full&&c.section==='routine'){
  // Expand rowspans back into a grid: merging must not move a value into another column or lose a row.
  const grid=[];[...printed.querySelector('.rp-list tbody').rows].forEach((tr,r)=>{
   grid[r]??=[];let col=0;for(const td of tr.cells){while(grid[r][col]!==undefined)col++;assert.equal(Number(td.dataset.column),col);for(let offset=0;offset<td.rowSpan;offset++){grid[r+offset]??=[];const copy=td.cloneNode(true);copy.querySelectorAll('.rp-issue-ref').forEach(n=>n.remove());grid[r+offset][col]=copy.textContent;}col++;}
   const e=state.entries.find(e=>e.id===tr.dataset.entryId),p=data.periods.find(p=>p.id===e.period);
   const nonMajor=w.GeoRoutineChecks.isNonMajor(data,e);
   const teacherWise=!c.filters.level&&data.teachers.some(t=>t.code===c.filters.teacher),course=w.GeoRoutinePrint.courseName(data,e);
   const expected=teacherWise?[e.day,p.start+'–'+p.end,nonMajor?'':e.level,course||w.GeoRoutinePrint.englishText(e.subject).trim(),nonMajor?'':[e.room?'Room '+e.room:'',course?w.GeoRoutinePrint.englishText(e.subject):''].filter(Boolean).join(' · ')||'—']:[e.day,p.start+'–'+p.end,c.filters.level||nonMajor?course||w.GeoRoutinePrint.englishText(e.subject).trim():e.level,nonMajor?'':e.teacherCodes.map(code=>data.teachers.find(t=>t.code===code)?.name||code).join(' / ')||'—',nonMajor?'':[e.room?'Room '+e.room:'',!c.filters.level||course?w.GeoRoutinePrint.englishText(e.subject):''].filter(Boolean).join(' · ')||'—'];
   assert.deepEqual(grid[r],expected);
  });
  if(c.filters.level)assert.equal(printed.querySelectorAll('.rp-list thead th')[2].textContent,'Course name');
  assert.equal(printed.querySelectorAll('.rp-list col').length,5);
  assert.equal(printed.querySelectorAll('.rp-day-start').length,new Set(state.entries.map(e=>e.day)).size);
  if(c.filters.teacher==='SR'){
    assert(printed.querySelector('.rp-teacher-wise'));assert.equal(printed.querySelectorAll('.rp-list thead th')[3].textContent,'Course / subject');
    assert(printed.querySelector('.rp-subtitle').textContent.includes('Md. Sohel Rana'));
    assert(!printed.querySelector('.rp-list').textContent.includes('Md. Sohel Rana'),'Teacher name belongs in header, not a repetitive column');
  }
  if(c.filters.day)assert.equal(printed.querySelector('td[data-column="0"]').rowSpan,state.entries.length);
 }
 w.dispatchEvent(new w.Event('afterprint'));assert.ok(!w.document.body.classList.contains('routine-print-ready'));
 // Fixtures contain only bundled source data and inline assets. They never authenticate or request data.
 const script=read('assets/class-routine-checks.js')+'\n'+read('assets/class-routine-subjects.js')+'\n'+read('assets/class-routine-format.js')+'\n'+read('assets/class-routine-print.js')+'\nconst fixture='+JSON.stringify(state)+';GeoRoutinePrint.configure(()=>fixture);GeoRoutinePrint.prepare('+JSON.stringify(c.section)+');';
 fs.writeFileSync(path.join(out,c.name+'.html'),'<!doctype html><html><head><meta charset="utf-8"><style>'+read('assets/class-routine.css')+read('assets/class-routine-print.css')+'</style></head><body class="routine-page"><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script></body></html>');
 fs.writeFileSync(path.join(out,c.name+'.expected.json'),JSON.stringify({entries:state.entries.length,courses:state.courses.length,section:c.section,landscape:full}));
 dom.window.close();
}
console.log('PASS: print orientations, reconstructed merged rows, year-grouped courses, source column order and cleanup; nine offline fixtures generated.');
