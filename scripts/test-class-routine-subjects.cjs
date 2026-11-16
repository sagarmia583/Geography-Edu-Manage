const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
(async()=>{
 const dom=new JSDOM('',{url:'https://fixture.invalid',runScripts:'outside-only'}),w=dom.window;
 try{
  w.GEO_SUPABASE_URL='https://fixture.invalid';w.GEO_SUPABASE_PUBLISHABLE_KEY='public';
  w.eval(read('assets/class-routine-subjects.js'));w.eval(read('assets/class-routine-checks.js'));w.eval(read('assets/class-routine-format.js'));w.eval(read('assets/class-routine-print.js'));w.eval(read('assets/class-routine-data.js'));
  const data=w.GEO_CLASS_ROUTINE_DATA,original=JSON.stringify(data),course=data.courses[0];
  let requests=[],response=[{SubjectCode:course.code,SubjectName:'Canonical subject name',AcademicYear:'Hons 1st Year'},{SubjectCode:course.code,SubjectName:'Different year',AcademicYear:'Honours 2nd Year'}];
  w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>response};};
  assert(await w.GeoRoutineSubjects.load(data));assert.equal(w.GeoRoutineSubjects.title(course),'Canonical subject name');
  assert.equal(JSON.stringify(data),original,'Loading names never mutates or saves routine data');
  assert.equal(requests[0].options.headers.Authorization,undefined);assert.equal(requests[0].options.cache,'no-store');
  const query=new URL(requests[0].url).searchParams;assert.equal(query.get('select'),'SubjectID,SubjectCode,SubjectName,AcademicYear,SubjectType,Status');assert.equal(query.get('SubjectCode'),null,'Load all year-wise subjects, not only existing routine codes');
  const slot=data.entries.find(e=>e.level===course.level);
  assert.equal(w.GeoRoutinePrint.courseName(data,{...slot,courseId:course.id}),'Canonical subject name');
  assert.equal(w.GeoRoutinePrint.courseName(data,{...slot,subject:'',courseId:''}),'Canonical subject name','Assigned teacher/year course rotates into the slot');
  for(const adminPreview of [false,true]){
   w.GeoRoutinePrint.configure(()=>({data,entries:[],courses:[course],filters:{},adminPreview}));
   assert(w.GeoRoutinePrint.prepare('courses').textContent.includes('Canonical subject name'));
  }
  response.push({SubjectCode:course.code,SubjectName:'Conflicting name',AcademicYear:course.level});
  await w.GeoRoutineSubjects.load(data);assert.equal(w.GeoRoutineSubjects.title(course),course.title);
  response=[{SubjectCode:course.code,SubjectName:'Other year only',AcademicYear:'Honours 2nd Year'}];
  await w.GeoRoutineSubjects.load(data);assert.equal(w.GeoRoutineSubjects.title(course),course.title);
  w.fetch=async()=>({ok:false});assert.equal(await w.GeoRoutineSubjects.load(data),false);assert.equal(w.GeoRoutineSubjects.title(course),course.title);
  w.fetch=async()=>{throw new Error('offline');};assert.equal(await w.GeoRoutineSubjects.load(data),false);
  assert.equal(w.GeoRoutineSubjects.title(undefined),'');
  console.log('PASS: Supabase subject matching, ambiguous/missing/failure fallback, unchanged stored data and shared print names.');
 }finally{w.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
