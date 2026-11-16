const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
(async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',url:'https://fixture.invalid'}),w=dom.window;
 try{
  for(const file of ['data','checks','subjects','format','print'])w.eval(read('assets/class-routine-'+file+'.js'));
  const base=w.GEO_CLASS_ROUTINE_DATA,level='Honours 4th Year';
  const course=(id,code,title,teacherCodes=['RS'],extra={})=>({id,code,title,level,teacherCodes,...extra});
  const entry=(id,day,period,extra={})=>({id,day,period,level,teacherCodes:['RS'],subject:'',room:'408',...extra});
  const data={...base,courses:[course('b','243213','Urban Geography'),course('a','243203','Oceanography'),course('non','240000','Non-major',['RS'],{subjectType:'Non-Major'}),course('prac','249999','Practical')],entries:[entry('e3','Monday',0),entry('e1','Sunday',0),entry('e4','Tuesday',0),entry('e2','Sunday',1),entry('fixed','Monday',1,{courseId:'b'}),entry('practical','Monday',2,{subject:'Practical'}),entry('nm','Monday',3,{subject:'Non-major: Botany'}),entry('other','Sunday',0,{teacherCodes:['AM']}),entry('shared','Sunday',0,{teacherCodes:['RS','AM']}),entry('year','Sunday',0,{level:'Honours 3rd Year'})]};
  const original=JSON.stringify(data),resolve=id=>w.GeoRoutineSubjects.courseFor(data,data.entries.find(e=>e.id===id))?.id;
  assert.deepEqual(['e1','e2','e3','e4'].map(resolve),['a','b','a','b']);
  assert.equal(resolve('fixed'),'b');for(const id of ['practical','nm','other','shared','year'])assert.equal(resolve(id),undefined);
  assert.equal(JSON.stringify(data),original,'Rotation is derived without modifying entries');
  const e4=data.entries.find(e=>e.id==='e4');
  assert.equal(w.GeoRoutinePrint.courseName(data,e4),'Urban Geography');
  let html;
  for(const adminPreview of [false,true]){
   w.GeoRoutinePrint.configure(()=>({data,entries:[e4],courses:data.courses,filters:{day:'Tuesday',teacher:'RS'},adminPreview}));
   const root=w.GeoRoutinePrint.prepare('routine');assert(root.textContent.includes('Urban Geography'));
   if(html)assert.equal(root.outerHTML,html);html=root.outerHTML;
  }
  data.courses[0].teacherCodes=['AM'];assert.deepEqual(['e1','e2','e3','e4'].map(resolve),['a','a','a','a'],'Assignment edits invalidate cached rotation');
  data.courses[0].teacherCodes=['RS'];data.courses[0].showInDistribution=false;assert.equal(resolve('e2'),'b','Distribution visibility does not remove a teaching assignment');
  w.GEO_SUPABASE_URL='https://fixture.invalid';w.GEO_SUPABASE_PUBLISHABLE_KEY='public';
  const records=[{SubjectCode:'243203',SubjectName:'Oceanography DB',AcademicYear:level,SubjectType:'Major',Status:'Active'},{SubjectCode:'243213',SubjectName:'Urban Geography DB',AcademicYear:level,SubjectType:'Major',Status:'Active'},{SubjectCode:'243205',SubjectName:'Geography of Disasters',AcademicYear:level,SubjectType:'Major',Status:'Active'},{SubjectCode:'243299',SubjectName:'Inactive',AcademicYear:level,SubjectType:'Major',Status:'Inactive'}];
  w.fetch=async()=>({ok:true,json:async()=>records});await w.GeoRoutineSubjects.load(data);
  assert.equal(w.GeoRoutinePrint.courseName(data,e4),'Urban Geography DB');
  const choices=w.GeoRoutineSubjects.courses(data,level);assert(choices.some(c=>c.code==='243205'));assert(!choices.some(c=>c.code==='243299'));
  assert.equal(choices.find(c=>c.code==='243205').showInDistribution,false);assert.equal(choices.find(c=>c.code==='243205').teacherCodes.length,0);
  assert(!w.GeoRoutineSubjects.list('Honours 1st Year').length);
  console.log('PASS: stable weekly teacher/year rotation, filters, explicit overrides, excluded slots, cache invalidation, year-wise catalogue and admin/student print parity.');
 }finally{w.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
