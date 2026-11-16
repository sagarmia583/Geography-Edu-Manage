(function(){
  'use strict';
  const text=value=>String(value??'').trim();
  function levelOrder(value){
    const name=text(value);
    if(/^XI$/i.test(name))return 0;
    if(/^XII$/i.test(name))return 1;
    const degree=name.match(/^Degree\s*([1-3])/i);if(degree)return 1+Number(degree[1]);
    const honours=name.match(/^(?:honou?rs?|hons\.?|h)\s*([1-4])/i);if(honours)return 4+Number(honours[1]);
    if(/^(masters?|m\.?sc)/i.test(name))return 9;
    return 10;
  }
  const compareLevels=(a,b)=>levelOrder(a.level)-levelOrder(b.level);
  const compareEntries=(data,a,b)=>data.days.indexOf(a.day)-data.days.indexOf(b.day)||data.periods.findIndex(p=>p.id===a.period)-data.periods.findIndex(p=>p.id===b.period)||compareLevels(a,b);
  function level(value){
    const name=text(value),honours=name.match(/^(?:honou?rs?|hons\.?)\s*([1-4])/i);
    if(honours)return 'H'+'₀₁₂₃₄'[Number(honours[1])];
    if(/^(masters?|m\.?sc)/i.test(name))return 'Msc';
    const degree=name.match(/^Degree\s*([1-3])/i);
    if(degree)return 'D'+'₀₁₂₃₄'[Number(degree[1])];
    if(/^degree/i.test(name))return 'Degree';
    return name;
  }
  function subjectSymbol(value){
    const name=text(value).replace(/^(?:non[\s-]*major|nm)\s*[:–—-]?\s*/i,'');
    for(const [pattern,label] of [[/economics|economic|^eco$|অর্থনীতি/i,'Economics'],[/political|^ps$|রাজনীতি|রাষ্ট্রবিজ্ঞান/i,'Political Science'],[/social work|^sw$|সমাজকর্ম/i,'Social Work'],[/botany|^bot$|উদ্ভিদ/i,'Botany'],[/zoology|^zoo$|প্রাণি/i,'Zoology'],[/bangla|^ban$|বাংলা/i,'Bangla'],[/english|^eng$|ইংরেজি/i,'English'],[/information.*technology|\bict\b/i,'ICT']])if(pattern.test(name))return label;
    return name;
  }
  function section(entry){
    if(!/^(XI|XII)$/i.test(text(entry.level)))return '';
    const value=Object.prototype.hasOwnProperty.call(entry,'section')?text(entry.section):/^(humanities|hum\b|science|sc\b|business|bus\b|all\b)/i.test(text(entry.subject))?text(entry.subject):'';
    return value.replace(/\bbusiness(?:\s+studies)?\b/gi,'Bus').replace(/\bhumanities\b/gi,'Hum').replace(/\bscience\b/gi,'Sc').replace(/all\s*groups/gi,'All').replace(/\b(Hum|Sc|Bus)(?:\s*[-:]\s*|\s+)([A-Z])(?=\s*(?:\+|$))/gi,(_,group,letter)=>group+':'+letter.toUpperCase()).replace(/\s+/g,'');
  }
  function fullEntry(data,entry){
    const teachers=(entry.teacherCodes||[]).map(text).filter(Boolean).join('/');
    const nonMajor=window.GeoRoutineChecks.isNonMajor(data,entry);
    const room=text(entry.room),suffix=section(entry);
    const course=window.GeoRoutineSubjects?.courseFor(data,entry)??data.courses?.find(c=>c.id===entry.courseId&&c.level===entry.level);
    const title=text(window.GeoRoutineSubjects?.title(course)??course?.title);
    const details=text(entry.subject).replace(/বাংলা/g,'Bangla');
    const sectionDetails=/^(XI|XII)$/i.test(text(entry.level))&&/^(humanities|hum\b|science|sc\b|business|bus\b|all\b)/i.test(details);
    const ict=/\bICT\b|information\s*(?:and|&)\s*communication\s*technology/i.test(details+' '+title);
    let symbol;
    if(nonMajor)symbol=subjectSymbol(window.GeoRoutineChecks.nonMajorName(data,entry));
    else{
      const label=ict?'ICT':!title&&!sectionDetails?details:!teachers&&!sectionDetails?(details||title):'';
      symbol=[teachers,label].filter(Boolean).join(' · ');
    }
    return level(entry.level)+(symbol?'-'+symbol:'')+(room?' ('+room+')':'')+(suffix?' '+suffix:'');
  }
  window.GeoRoutineFormat={level,levelOrder,compareLevels,compareEntries,subjectSymbol,section,fullEntry};
})();
