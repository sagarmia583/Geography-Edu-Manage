(function(){
  'use strict';
  const clean=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
  const room=value=>clean(value).replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/^room\s*[:#-]?\s*/,'');
  const known=value=>value&&!['-','—','n/a','unknown','not specified'].includes(value);
  const nonMajorPrefix=/^(?:non[\s-]*major|nm)\s*(?::|[-–—])?\s*/i;
  const course=(data,entry)=>data.courses?.find(c=>c.id===entry.courseId&&c.level===entry.level);
  function isNonMajor(data,entry){return nonMajorPrefix.test(String(entry.subject||''))||clean(entry.subjectType||course(data,entry)?.subjectType).replace(/[\s-]/g,'')==='nonmajor';}
  function nonMajorName(data,entry){return String(entry.subject||course(data,entry)?.title||'').replace(nonMajorPrefix,'').trim().replace(/বাংলা/g,'Bangla');}
  function checksEnabled(data,entry){
    if(!/^(?:honours?|honors?|hons\.?)\s+[1-4](?:st|nd|rd|th)?\s+year$/i.test(String(entry.level||'').trim())||isNonMajor(data,entry))return false;
    const type=clean(entry.subjectType||course(data,entry)?.subjectType).replace(/[\s-]/g,'');
    if(type&&type!=='major')return false;
    return !/^(?:ict|information and communication technology|english(?:\s+non[\s-]*credit)?)$/i.test(String(entry.subject||'').trim());
  }
  const noteText=value=>({
    'ICT is printed on the next line; its association with this entry needs confirmation.':'মূল রুটিনে আইসিটি পরের লাইনে আছে; এটি এই ক্লাসের বিষয় কি না নিশ্চিত করুন।',
    'Room is not specified in the source.':'মূল রুটিনে কক্ষ উল্লেখ নেই।',
    'ALL is printed instead of a specific teacher code.':'নির্দিষ্ট শিক্ষকের পরিবর্তে ALL লেখা আছে; দায়িত্বপ্রাপ্ত শিক্ষক নিশ্চিত করুন।',
    'Teacher and room are not specified in the source.':'মূল রুটিনে শিক্ষক ও কক্ষ উল্লেখ নেই।',
    'Teacher is not specified in the source.':'মূল রুটিনে শিক্ষক উল্লেখ নেই।'
  }[value]||value||'তথ্য যাচাই করে নিশ্চিত করুন।');
  function analyze(data){
    const byEntry=new Map(data.entries.map(e=>[e.id,[]])),groups=[],periods=new Map(data.periods.map(p=>[p.id,p]));
    const entries=data.entries.filter(e=>checksEnabled(data,e));
    const add=(kind,message,rows)=>{const issue={code:({teacher:'T',room:'R',duplicate:'D',review:'N'}[kind])+(groups.filter(g=>g.kind===kind).length+1),kind,message,rows};groups.push(issue);rows.forEach(e=>byEntry.get(e.id)?.push(issue));};
    const overlap=(a,b)=>{const p=periods.get(a.period),q=periods.get(b.period);return a.day===b.day&&p&&q&&p.start<q.end&&q.start<p.end;};
    const label=e=>e.day+' '+(periods.get(e.period)?.label||'')+' · '+e.level;
    for(const kind of ['teacher','room']){
      const buckets=new Map();entries.forEach(e=>{const values=kind==='teacher'?[...new Set((e.teacherCodes||[]).map(clean))]:[room(e.room)];values.filter(known).forEach(value=>{const key=e.day+'|'+value;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(e);});});
      for(const [key,rows] of buckets){
        const pairs=new Map();for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(overlap(rows[i],rows[j])){const ids=[rows[i].period,rows[j].period].sort().join('|');if(!pairs.has(ids))pairs.set(ids,new Set());pairs.get(ids).add(rows[i]);pairs.get(ids).add(rows[j]);}
        pairs.forEach(set=>{const affected=[...set],value=key.slice(key.indexOf('|')+1);add(kind,(kind==='teacher'?'শিক্ষক '+value.toUpperCase():'কক্ষ '+value)+' একই সময়ে একাধিক ক্লাসে নির্ধারিত: '+affected.map(label).join(' / '),affected);});
      }
    }
    const duplicates=new Map();entries.forEach(e=>{const key=JSON.stringify([e.day,e.period,e.level,[...new Set(e.teacherCodes.map(clean))].sort(),room(e.room),clean(e.subject)]);if(!duplicates.has(key))duplicates.set(key,[]);duplicates.get(key).push(e);});
    duplicates.forEach(rows=>{if(rows.length>1)add('duplicate','একই ক্লাস একাধিকবার যোগ করা হয়েছে: '+label(rows[0]),rows);});
    const missingRoom=entries.filter(e=>!known(room(e.room)));if(missingRoom.length)add('review','কক্ষ উল্লেখ নেই; রুটিন ব্যবহারের আগে কক্ষ নিশ্চিত করুন।',missingRoom);
    const missingTeacher=entries.filter(e=>!e.teacherCodes.length);if(missingTeacher.length)add('review','শিক্ষক উল্লেখ নেই; দায়িত্বপ্রাপ্ত শিক্ষক নিশ্চিত করুন।',missingTeacher);
    entries.filter(e=>e.uncertain).forEach(e=>add('review',label(e)+': '+noteText(e.note),[e]));
    entries.filter(e=>new Set(e.teacherCodes.map(clean)).size!==e.teacherCodes.length).forEach(e=>add('review',label(e)+': একই শিক্ষক একাধিকবার বাছাই করা হয়েছে।',[e]));
    return {byEntry,groups};
  }
  window.GeoRoutineChecks={analyze,noteText,isNonMajor,nonMajorName,checksEnabled};
})();
