(function(){
  'use strict';
  let rows=[],loaded=false,revision=0;
  const cache=new WeakMap();
  const clean=value=>String(value??'').trim();
  const year=value=>clean(value).toLowerCase().replace(/honou?rs?|hons?\.?/g,'honours').replace(/msc|m\.sc\.?|masters?\s*(final)?\s*(year)?/g,'masters').replace(/\s+/g,' ').trim();
  function title(course){
    if(!course)return '';
    const candidates=rows.filter(row=>clean(row.SubjectCode)===clean(course.code));
    const exact=candidates.filter(row=>year(row.AcademicYear)===year(course.level));
    // Conflicting names or a different academic year must never select an arbitrary row.
    const eligible=exact.length?exact:candidates.filter(row=>!clean(row.AcademicYear));
    const names=[...new Set(eligible.map(row=>clean(row.SubjectName)).filter(Boolean))];
    return names.length===1?names[0]:course.title||'';
  }
  const active=row=>!clean(row.Status)||clean(row.Status).toLowerCase()==='active';
  function list(level){
    const groups=new Map();
    rows.filter(r=>year(r.AcademicYear)===year(level)&&active(r)&&clean(r.SubjectCode)&&clean(r.SubjectName)).forEach(row=>{const code=clean(row.SubjectCode);if(!groups.has(code))groups.set(code,[]);groups.get(code).push(row);});
    return [...groups].filter(([,group])=>new Set(group.map(r=>clean(r.SubjectName))).size===1).map(([code,group])=>({id:'subject:'+year(level)+':'+code,level,code,title:clean(group[0].SubjectName),subjectType:clean(group[0].SubjectType),teacherCodes:[],showInDistribution:false})).sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
  }
  function courses(data,level){
    const saved=data.courses.filter(c=>year(c.level)===year(level));
    return [...saved,...list(level).filter(c=>!saved.some(s=>clean(s.code)===c.code))];
  }
  function eligible(data,entry){
    return !entry.courseId&&!clean(entry.subject)&&entry.teacherCodes?.length===1&&/^(honours|masters)/.test(year(entry.level))&&!window.GeoRoutineChecks?.isNonMajor(data,entry);
  }
  function assignments(data){
    const signature=JSON.stringify([revision,data.days,data.periods.map(p=>[p.id,p.start]),data.entries.map(e=>[e.id,e.level,e.day,e.period,e.teacherCodes,e.courseId,e.subject,e.subjectType]),data.courses]);
    const previous=cache.get(data);if(previous?.signature===signature)return previous.map;
    const map=new Map(),counts=new Map();
    const sorted=[...data.entries].sort((a,b)=>data.days.indexOf(a.day)-data.days.indexOf(b.day)||String(data.periods.find(p=>p.id===a.period)?.start).localeCompare(String(data.periods.find(p=>p.id===b.period)?.start))||String(a.id).localeCompare(String(b.id)));
    sorted.forEach(entry=>{
      if(!eligible(data,entry))return;
      const teacher=entry.teacherCodes[0],key=year(entry.level)+'|'+teacher;
      const catalog=list(entry.level),seen=new Set();
      const choices=data.courses.filter(c=>{
        const source=catalog.find(s=>s.code===clean(c.code));
        const type=clean(source?.subjectType||c.subjectType).toLowerCase().replace(/[\s-]/g,'');
        if(year(c.level)!==year(entry.level)||!c.teacherCodes.includes(teacher)||(loaded&&!source)||type==='nonmajor'||/practical|research project|field\s*work/i.test(title(c)))return false;
        const identity=clean(c.code)||c.id;if(seen.has(identity))return false;seen.add(identity);return true;
      }).sort((a,b)=>clean(a.code).localeCompare(clean(b.code),undefined,{numeric:true})||a.id.localeCompare(b.id));
      if(!choices.length)return;
      const index=counts.get(key)||0;map.set(entry.id,choices[index%choices.length]);counts.set(key,index+1);
    });
    cache.set(data,{signature,map});return map;
  }
  function courseFor(data,entry){
    if(entry.courseId)return data.courses.find(c=>c.id===entry.courseId&&year(c.level)===year(entry.level));
    return assignments(data).get(entry.id);
  }
  async function load(data){
    rows=[];loaded=false;revision++;
    if(!window.GEO_SUPABASE_URL||!window.GEO_SUPABASE_PUBLISHABLE_KEY)return false;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000),fetched=[];
    try{
        for(let offset=0;;offset+=500){
          const query=new URLSearchParams({select:'SubjectID,SubjectCode,SubjectName,AcademicYear,SubjectType,Status',order:'row_id.asc',limit:'500',offset:String(offset)});
          const response=await fetch(window.GEO_SUPABASE_URL+'/rest/v1/subjects?'+query,{headers:{apikey:window.GEO_SUPABASE_PUBLISHABLE_KEY,Accept:'application/json'},cache:'no-store',signal:controller.signal});
          if(!response.ok)throw new Error('Subjects unavailable');
          const page=await response.json();if(!Array.isArray(page))throw new Error('Invalid Subjects response');
          fetched.push(...page);if(page.length<500)break;
        }
      rows=fetched;revision++;return true;
    }catch(error){return false;}finally{clearTimeout(timer);}
  }
  window.GeoRoutineSubjects={load:async data=>{const ok=await load(data);loaded=ok;return ok;},title,list,courses,courseFor};
})();
