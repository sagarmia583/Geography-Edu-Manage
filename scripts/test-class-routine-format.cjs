const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
try{
 for(const file of ['checks','format','subjects','print','data'])w.eval(fs.readFileSync(path.join(__dirname,'../assets/class-routine-'+file+'.js'),'utf8'));
 const data=w.GEO_CLASS_ROUTINE_DATA,format=w.GeoRoutineFormat.fullEntry;
 const base={id:'sample',level:'Honours 1st Year',teacherCodes:['AM'],room:'408',subject:''};
 assert.equal(format(data,base),'H₁-AM (408)');
 for(const [level,label] of [['Honours 2nd Year','H₂'],['Honours 3rd Year','H₃'],['Honours 4th Year','H₄'],['Masters','Msc'],['Degree 1st Year','D₁'],['Degree 2nd Year','D₂'],['Degree 3rd Year','D₃'],['XI','XI'],['XII','XII']])assert.equal(format(data,{...base,level}),label+'-AM (408)');
 assert.equal(format(data,{...base,teacherCodes:[],subject:'Non-major: Economics',room:'703'}),'H₁-Economics (703)');
 assert.equal(format(data,{...base,teacherCodes:[],subject:'Non-major: Social Work'}),'H₁-Social Work (408)');
 assert.equal(format(data,{...base,teacherCodes:[],subject:'Non-major: Political Science'}),'H₁-Political Science (408)');
 assert.equal(format(data,{...base,subject:'Non-major: Economics'}),'H₁-Economics (408)','Non-major entries display the subject name');
 for(const subject of ['Zoology','Botany','English','ICT'])assert.equal(format(data,{...base,subject:'Non-major: '+subject}),'H₁-'+subject+' (408)');
 assert.equal(format(data,{...base,teacherCodes:['RS','AM'],subject:'Practical'}),'H₁-RS/AM · Practical (408)');
 assert.equal(format(data,{...base,room:'',teacherCodes:[],subject:''}),'H₁');
 assert.equal(format(data,{...base,level:'XI',section:'Humanities-C'}),'XI-AM (408) Hum:C');
 assert.equal(format(data,{...base,level:'XII',subject:'Business Studies'}),'XII-AM (408) Bus');
 assert.equal(format(data,{...base,level:'XI',subject:'Humanities C'}),'XI-AM (408) Hum:C');
 assert.equal(format(data,{...base,level:'XI',subject:'Science A + Humanities A + Business Studies'}),'XI-AM (408) Sc:A+Hum:A+Bus');
 assert.equal(format(data,{...base,level:'XI',subject:'Humanities C',section:''}),'XI-AM (408)','Explicitly clearing a section must suppress legacy fallback');
 const history={...base,day:data.days[0],period:data.periods[0].id,teacherCodes:[],subject:'History of BD',courseId:'history-test'};
 data.courses.push({id:'history-test',level:base.level,title:'History of Bangladesh: Language, Culture and Identity',teacherCodes:[]});
 assert.equal(format(data,history),'H₁-History of BD (408)');
 assert.equal(w.GeoRoutinePrint.classSubject(data,history),'History of Bangladesh: Language, Culture and Identity');
 const fallback={...history,courseId:''};
 assert.equal(w.GeoRoutinePrint.classSubject(data,fallback),'History of BD');
 assert.equal(format(data,{...fallback,teacherCodes:['SR']}),'H₁-SR · History of BD (408)');
 assert.equal(format(data,{...base,teacherCodes:['SR'],subject:'ICT'}),'H₁-SR · ICT (408)');
 data.courses.push({id:'ict-test',level:base.level,title:'Information and Communication Technology',teacherCodes:['SR']});
 assert.equal(format(data,{...base,teacherCodes:['SR'],courseId:'ict-test'}),'H₁-SR · ICT (408)');
 for(const filters of [{},{level:base.level}]){
  w.GeoRoutinePrint.configure(()=>({data,entries:[fallback],courses:data.courses,filters}));
  const printed=w.GeoRoutinePrint.prepare();
  assert(printed.textContent.includes('History of BD'),'Details fallback must appear in full and class-wise print');
 }
 for(const [section,label] of [['Humanities','Hum'],['Science','Sc'],['Business','Bus'],['Business-C','Bus:C']])assert.equal(format(data,{...base,level:'XI',section}),'XI-AM (408) '+label);
 assert.equal(format(data,{...base,level:'XI',section:'Hum:C + Sc:A + Bus'}),'XI-AM (408) Hum:C+Sc:A+Bus');
 assert.equal(format(data,{...base,level:'XII',subject:'Hum:C + Sc:A + Bus'}),'XII-AM (408) Hum:C+Sc:A+Bus');
 const orderedLevels=['XI','XII','Degree 1st Year','Degree 2nd Year','Degree 3rd Year','Honours 1st Year','Honours 2nd Year','Honours 3rd Year','Honours 4th Year','Masters'];
 const shuffled=orderedLevels.map((level,i)=>({...base,id:'order-'+i,level,day:data.days[0],period:data.periods[0].id})).reverse();
 const before=JSON.stringify(shuffled);
 assert.deepEqual([...shuffled].sort(w.GeoRoutineFormat.compareLevels).map(e=>e.level),orderedLevels);
 for(const adminPreview of [false,true])for(const filters of [{},{day:data.days[0]}]){
   w.GeoRoutinePrint.configure(()=>({data,entries:shuffled,courses:data.courses,filters,adminPreview}));
   const root=w.GeoRoutinePrint.prepare();
   assert.deepEqual(Array.from(root.querySelectorAll('[data-entry-id]'),el=>el.dataset.entryId),orderedLevels.map((_,i)=>'order-'+i));
 }
 assert.equal(JSON.stringify(shuffled),before,'Sorting must not change stored entries or course rotation');
 for(const adminPreview of [false,true]){
  w.GeoRoutinePrint.configure(()=>({data,entries:data.entries,courses:data.courses,filters:{},adminPreview}));
  const root=w.GeoRoutinePrint.prepare();
  for(const entry of data.entries)assert.equal(root.querySelector('[data-entry-id="'+entry.id+'"]').textContent,format(data,entry));
  assert(!root.querySelector('.rp-week').textContent.includes('Geographical Thoughts'));
  assert.equal(root.querySelectorAll('.rp-higher-secondary').length,data.entries.filter(e=>['XI','XII'].includes(e.level)).length);
 }
 console.log('PASS: full routine symbols, Degree year labels, full non-major names, XI/XII sections and shared print output.');
}finally{w.close();}
