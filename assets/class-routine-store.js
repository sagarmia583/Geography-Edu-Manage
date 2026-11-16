(function(){
  'use strict';
  const errorText=error=>{const text=String(error?.message||error||'');if(/[\u0980-\u09ff]/.test(text))return text;if(/draft changed/i.test(text))return 'অন্য ট্যাব থেকে খসড়া পরিবর্তন হয়েছে। খসড়া আবার লোড করুন।';return 'কাজটি সম্পন্ন করা যায়নি। ইন্টারনেট সংযোগ ও রুটিনের তথ্য পরীক্ষা করে আবার চেষ্টা করুন।';};
  const clone = value => JSON.parse(JSON.stringify(value));
  function effectiveDateToday(instant=new Date()){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));
    const value=type=>parts.find(p=>p.type===type).value;
    return value('year')+'-'+value('month')+'-'+value('day');
  }
  function publishedRecord(record){
    const result=clone(record);
    // Use the successful database publication time, never the viewer's current day.
    if(result.published_at&&Number.isFinite(Date.parse(result.published_at)))result.document.effectiveDate=effectiveDateToday(result.published_at);
    validate(result.document);return result;
  }
  function validate(data){
    if(!data || !Array.isArray(data.entries) || !Array.isArray(data.courses)) throw new Error('রুটিনের তথ্য সঠিক বিন্যাসে নেই।');
    if(data.printAssets!==undefined){
      if(!data.printAssets||typeof data.printAssets!=='object'||Array.isArray(data.printAssets))throw new Error('স্বাক্ষর ও সিলের তথ্য সঠিক নয়।');
      for(const key of ['signature','seal']){
        const value=data.printAssets[key];
        if(value!==undefined&&(typeof value!=='string'||value.length>512000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)))throw new Error('স্বাক্ষর বা সিলের জন্য ছোট PNG, JPG বা WebP ছবি দিন।');
      }
    }
    for(const field of ['days','periods','teachers','levels','notes']) if(!Array.isArray(data[field])) throw new Error('প্রয়োজনীয় তথ্য নেই: '+field);
    for(const field of ['effectiveDate','distributionDate']) if(!/^\d{4}-\d{2}-\d{2}$/.test(data[field]||'') || !Number.isFinite(Date.parse(data[field])) || new Date(data[field]).toISOString().slice(0,10)!==data[field]) throw new Error('সঠিক তারিখ লিখুন।');
    const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'');
    const unique=(rows,key)=>new Set(rows.map(key)).size===rows.length;
    if(!data.days.length || !unique(data.days,x=>x) || !data.levels.length || !unique(data.levels,x=>x)) throw new Error('একই দিন বা বর্ষ একাধিকবার দেওয়া যাবে না।');
    if(!data.periods.length || !unique(data.periods,p=>p.id)) throw new Error('প্রতিটি সময়ের পরিচিতি আলাদা হতে হবে।');
    let end='00:00';
    data.periods.forEach(p=>{
      if(!validTime(p.start)||!validTime(p.end)||p.start>=p.end||p.start<end) throw new Error('ক্লাসের সময় ক্রমানুসারে দিন; একটি সময়ের সঙ্গে অন্যটির সংঘর্ষ থাকা যাবে না।');
      end=p.end;
    });
    if(!data.break || !Number.isInteger(data.break.afterPeriod) || !data.periods[data.break.afterPeriod] || !validTime(data.break.start)||!validTime(data.break.end)||data.break.start>=data.break.end) throw new Error('বিরতির সময় সঠিক নয়।');
    if(data.break.start<data.periods[data.break.afterPeriod].end || (data.periods[data.break.afterPeriod+1] && data.break.end>data.periods[data.break.afterPeriod+1].start)) throw new Error('বিরতির সময় ক্লাসের সময়ের সঙ্গে মিলে যাচ্ছে।');
    if(!unique(data.teachers,t=>t.code) || data.teachers.some(t=>!t.code?.trim()||!t.name?.trim())) throw new Error('প্রতিটি শিক্ষকের আলাদা কোড ও পূর্ণ নাম দিতে হবে।');
    for(const field of ['entries','courses']){
      if(!unique(data[field],r=>r.id)) throw new Error('একই তথ্যের পরিচিতি একাধিকবার আছে: '+field);
      for(const row of data[field]){
        if(!row.id || !data.levels.includes(row.level) || !Array.isArray(row.teacherCodes) || row.teacherCodes.some(code=>!data.teachers.some(t=>t.code===code))) throw new Error('বর্ষ ও শিক্ষকের তথ্য পরীক্ষা করুন: '+field+' ('+row.id+').');
        if(field==='entries' && (!data.days.includes(row.day)||!data.periods.some(p=>p.id===row.period))) throw new Error('দিন বা সময় সঠিক নয়: '+row.id);
        if(field==='entries' && row.courseId && !data.courses.some(c=>c.id===row.courseId&&c.level===row.level)) throw new Error('একই বর্ষের কোর্স বেছে নিন অথবা ক্লাসের কোর্স নির্বাচন ফাঁকা করুন ('+row.id+').');
        if(field==='entries' && row.section!==undefined && (typeof row.section!=='string'||row.section.length>80)) throw new Error('সেকশনের নাম সর্বোচ্চ ৮০ অক্ষরে লিখুন।');
        if(field==='courses' && !row.title?.trim()) throw new Error('কোর্সের নাম লিখতে হবে।');
        if(field==='courses' && row.showInDistribution!==undefined && typeof row.showInDistribution!=='boolean') throw new Error('Course Distribution-এ দেখানোর নির্বাচন সঠিক নয়।');
      }
    }
    return data;
  }
  function conflicts(data){
    const slots=new Map();
    data.entries.forEach(e=>e.teacherCodes.forEach(t=>{const key=e.day+'|'+e.period+'|'+t;slots.set(key,[...(slots.get(key)||[]),e]);}));
    return [...slots].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,rows}));
  }
  async function request(path,{body,admin=false}={}){
    const headers={apikey:window.GEO_SUPABASE_PUBLISHABLE_KEY,Accept:'application/json'};
    if(admin){
      const token=await window.geoAdminAccessToken?.();
      if(!token) throw new Error('অ্যাডমিন হিসেবে লগইন করুন।');
      headers.Authorization='Bearer '+token;
    }
    if(body!==undefined) headers['Content-Type']='application/json';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const fetcher=admin?window.geoSupabaseFetch:window.fetch.bind(window);
      const response=await fetcher(window.GEO_SUPABASE_URL+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal});
      const result=await response.json();
      if(!response.ok){
        if(['42P01','PGRST205','PGRST202'].includes(result.code)) throw new Error('রুটিনের ডেটাবেজ সেটআপ বাকি আছে। database/class-routine-management.sql একবার চালান।');
        if(result.code==='40001') throw new Error('অন্য ট্যাব থেকে খসড়া পরিবর্তন হয়েছে। খসড়া আবার লোড করে সম্পাদনা করুন।');
        if(response.status===401||response.status===403) throw new Error('রুটিনে প্রবেশ বা পরিবর্তনের অনুমতি নেই। অ্যাডমিন অ্যাকাউন্ট ও ডেটাবেজের অনুমতি পরীক্ষা করুন।');
        throw new Error('ডেটাবেজে অনুরোধটি সম্পন্ন হয়নি। অ্যাডমিনের অনুমতি ও রুটিনের তথ্য পরীক্ষা করুন।'+(result.code?' (কোড: '+result.code+')':''));
      }
      return result;
    }catch(error){if(error.name==='AbortError') throw new Error('রুটিন লোডের সময় শেষ হয়েছে। আবার চেষ্টা করুন।');throw new Error(errorText(error));}
    finally{clearTimeout(timeout);}
  }
  window.GeoRoutineStore={clone,validate,conflicts,errorText,effectiveDateToday,
    async published(){const rows=await request('class_routine_published?id=eq.1&select=document,revision,published_at');if(!rows[0]) throw new Error('এখনও রুটিন প্রকাশ করা হয়নি।');return publishedRecord(rows[0]);},
    async draft(){const rows=await request('class_routine_drafts?id=eq.1&select=document,revision,updated_at',{admin:true});if(!rows[0]) throw new Error('রুটিনের খসড়া পাওয়া যায়নি। ডেটাবেজের সেটআপ সম্পন্ন করুন।');validate(rows[0].document);return rows[0];},
    save(document,revision){validate(document);return request('rpc/save_class_routine_draft',{admin:true,body:{p_document:document,p_expected_revision:revision}});},
    async publish(revision){return publishedRecord(await request('rpc/publish_class_routine',{admin:true,body:{p_expected_revision:revision}}));}
  };
})();
