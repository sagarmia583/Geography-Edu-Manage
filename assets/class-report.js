(function(){
  'use strict';
  const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  let data=null,fingerprint='',requestId=0,rows=[],cohorts=new Map(),sessions=new Map(),present=new Map(),loadedDate='';
  const clean=v=>String(v??'').trim();
  const digits=v=>clean(v).replace(/[০-৯]/g,c=>'০১২৩৪৫৬৭৮৯'.indexOf(c));
  const bn=v=>String(v).replace(/[0-9]/g,c=>'০১২৩৪৫৬৭৮৯'[Number(c)]);
  function levelKey(value){
    const s=digits(value).toLowerCase().replace(/honours|honors|honour|hons\.?/g,'honours').replace(/\s+/g,' ').trim();
    if(/master|msc|m\.sc/.test(s))return 'masters';
    if(/^(xi|class\s*11|11th(?:\s*class)?|hsc\s*1st(?:\s*year)?)$/.test(s))return 'xi';
    if(/^(xii|class\s*12|12th(?:\s*class)?|hsc\s*2nd(?:\s*year)?)$/.test(s))return 'xii';
    const year=s.match(/^(?:honours\s*|degree(?:\s*\(pass\))?\s*)?([1-4])(?:st|nd|rd|th)?\s*(?:year)?$/);
    if(year)return (s.includes('degree')?'degree':'honours')+year[1];
    return s;
  }
  function dateDay(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('সঠিক তারিখ বেছে নিন।');
    const date=new Date(value+'T00:00:00Z');
    if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('সঠিক তারিখ বেছে নিন।');
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getUTCDay()];
  }
  const externalLevel=level=>{const key=levelKey(level);return key.startsWith('degree')||key==='xi'||key==='xii';};
  function today(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(key=>parts.find(p=>p.type===key).value).join('-');}
  function status(text,error=false){$('daily-status').textContent=text;$('daily-status').dataset.error=String(error);}
  function invalidate(text='তারিখ ও ফিল্টার অনুযায়ী Load report চাপুন।'){
    requestId++;rows=[];loadedDate='';present.clear();cohorts.clear();sessions.clear();
    $('daily-load').disabled=false;$('daily-print').disabled=true;$('daily-preview').replaceChildren();$('daily-sessions').replaceChildren();
    document.getElementById('daily-print-root')?.remove();status(text);
  }
  function options(id,items){const el=$(id),old=el.value;el.replaceChildren();const all=node('option','All '+(id==='daily-level'?'levels':'teachers'));all.value='';el.append(all);items.forEach(item=>{const option=node('option',item.label);option.value=item.value;el.append(option);});if([...el.options].some(op=>op.value===old))el.value=old;}
  function roster(students,level){
    const unique=new Map();
    for(const student of students){
      if(/^(deleted|delete|removed|remove|inactive|archived|archive)$/i.test(clean(student.Status)))continue;
      if(levelKey(student.CurrentYear||student.AcademicYear)!==levelKey(level))continue;
      const identity=clean(student.Roll)||clean(student.RegistrationNumber);if(!identity)continue;
      const session=clean(student.StudySessionYear||student.CurrentStudySession||student.SessionYear);
      unique.set(identity,{session});
    }
    const counts=new Map();for(const {session} of unique.values())counts.set(session,(counts.get(session)||0)+1);return counts;
  }
  function total(row){if(externalLevel(row.entry.level))return undefined;const session=sessions.get(row.entry.level);return session?cohorts.get(row.entry.level)?.get(session):undefined;}
  function ready(){return rows.length>0&&rows.every(row=>externalLevel(row.entry.level)||(Number.isInteger(total(row))&&total(row)>0));}
  function validatePresent(){
    for(const row of rows){const value=present.get(row.key)||'';if(value!==''&&(!/^\d+$/.test(value)||Number(value)>total(row)))throw new Error('উপস্থিত সংখ্যা ০ থেকে মোট শিক্ষার্থীর মধ্যে পূর্ণসংখ্যা হতে হবে।');}
  }
  function updatePrint(){try{validatePresent();$('daily-print').disabled=!ready();return true;}catch(error){$('daily-print').disabled=true;status(error.message,true);return false;}}
  function shortLevel(level){return ({'honours1':'H₁','honours2':'H₂','honours3':'H₃','honours4':'H₄','masters':'MSc','degree1':'D₁','degree2':'D₂','degree3':'D₃'})[levelKey(level)]||level;}
  function table(print=false){
    const table=node('table');table.className='daily-table';
    const cols=node('colgroup');[24,18,18,12,12,16].forEach(width=>{const c=node('col');c.style.width=width+'%';cols.append(c);});table.append(cols);
    const head=node('thead'),header=node('tr');['শিক্ষকের নাম','শ্রেণি','মোট শিক্ষার্থী সংখ্যা','উপস্থিত','অনুপস্থিত','স্বাক্ষর'].forEach(text=>header.append(node('th',text)));head.append(header);table.append(head);
    const body=node('tbody');let previous='',teacherCell;
    for(const row of rows){
      const tr=node('tr');tr.dataset.reportRow=row.key;
      if(previous===row.teacher){teacherCell.rowSpan++;}else{teacherCell=node('td',row.name);teacherCell.className='daily-teacher-name';tr.append(teacherCell);previous=row.teacher;}
      const cell=node('td',shortLevel(row.entry.level));
      if(!externalLevel(row.entry.level))cell.append(node(print?'span':'small',(print?' · ':'')+(sessions.get(row.entry.level)||'Session not selected')));
      const period=data.periods.find(p=>p.id===row.entry.period);cell.append(node('small',period?.label||''));tr.append(cell);
      const count=total(row);tr.append(node('td',count===undefined?(print||externalLevel(row.entry.level)?'':'—'):bn(count)));
      const value=present.get(row.key)||'',attendance=node('td'),absent=node('td',value!==''&&Number.isInteger(count)&&/^\d+$/.test(value)&&Number(value)<=count?bn(count-Number(value)):'');
      if(print)attendance.textContent=value===''?'':bn(value);
      else{const input=node('input');input.type='text';input.inputMode='numeric';input.value=value;input.disabled=count===undefined;input.setAttribute('aria-label',row.name+' '+row.entry.level+' '+(period?.label||'')+' উপস্থিত');input.oninput=()=>{const v=digits(input.value);present.set(row.key,v);const valid=v===''||(/^\d+$/.test(v)&&Number(v)<=count);input.setAttribute('aria-invalid',String(!valid));absent.textContent=valid&&v!==''?bn(count-Number(v)):'';if(updatePrint())status('উপস্থিতির সংখ্যা প্রিন্টে যাবে। অনুপস্থিত স্বয়ংক্রিয়ভাবে হিসাব করা হয়েছে।');};attendance.append(input);}
      tr.append(attendance,absent,node('td'));body.append(tr);
    }
    if(print)for(let i=rows.length;i<14;i++){const tr=node('tr');for(let c=0;c<6;c++)tr.append(node('td','\u00a0'));body.append(tr);}
    table.append(body);return table;
  }
  function render(){
    $('daily-preview').replaceChildren(table());updatePrint();
    if(!ready())status('যে বর্ষে একাধিক সেশন আছে, সেশন বেছে নিন। শিক্ষার্থী বা সেশন না পাওয়া গেলে Students তথ্য ও পড়ার অনুমতি পরীক্ষা করুন।',true);
    else status(rows.length+'টি ক্লাসের সারি প্রস্তুত। উপস্থিত লিখুন অথবা হাতে পূরণের জন্য ফাঁকা রেখে প্রিন্ট করুন।'+(rows.some(row=>externalLevel(row.entry.level))?' Degree, XI ও XII-এর শিক্ষার্থী তথ্য প্রয়োজন নেই; সংখ্যার ঘর ফাঁকা রেখেই প্রিন্ট হবে।':''));
  }
  async function load(){
    invalidate();const id=requestId,selectedDate=$('daily-date').value;
    try{
      const day=dateDay(selectedDate);if(!data)throw new Error('আগে রুটিন লোড হতে দিন।');
      if(selectedDate<data.effectiveDate)throw new Error('এই তারিখ বর্তমান রুটিন কার্যকর হওয়ার আগের। ওই সময়ের রুটিন এখানে নেই।');
      const entries=data.entries.filter(e=>e.day===day&&(!$('daily-level').value||e.level===$('daily-level').value));
      const reportRows=[];for(const entry of entries){for(const code of new Set(entry.teacherCodes.length?entry.teacherCodes:['__unassigned'])){if($('daily-teacher').value&&code!==$('daily-teacher').value)continue;reportRows.push({key:entry.id+'|'+code,entry,teacher:code,name:data.teachers.find(t=>t.code===code)?.name||'শিক্ষক নির্ধারিত নয়'});}}
      if(!reportRows.length){status('নির্বাচিত তারিখ ও ফিল্টারে কোনো ক্লাস নেই।');return;}
      $('daily-load').disabled=true;status('রিপোর্ট প্রস্তুত হচ্ছে…');
      const needsStudents=reportRows.some(row=>!externalLevel(row.entry.level));
      if(needsStudents)status('ডেটাবেজ থেকে শিক্ষার্থীর সংখ্যা আনা হচ্ছে…');
      const result=needsStudents?await window.geoApiGet('getStudents',{allSessions:'1',forceFresh:'1',noCache:'1'}):{success:true,students:[]};
      if(id!==requestId)return;
      if(!result||result.success===false||!Array.isArray(result.students))throw new Error('শিক্ষার্থী তালিকা লোড হয়নি। অ্যাডমিনের অনুমতি ও সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
      loadedDate=selectedDate;
      rows=reportRows.sort((a,b)=>data.teachers.findIndex(t=>t.code===a.teacher)-data.teachers.findIndex(t=>t.code===b.teacher)||data.levels.indexOf(a.entry.level)-data.levels.indexOf(b.entry.level)||a.entry.period-b.entry.period);
      for(const level of new Set(rows.map(row=>row.entry.level))){
        if(externalLevel(level))continue;
        const counts=roster(result.students,level);cohorts.set(level,counts);
        const label=node('label',level+' — Session'),select=node('select');select.dataset.level=level;
        const empty=node('option',counts.size?'সেশন বেছে নিন':'শিক্ষার্থী পাওয়া যায়নি');empty.value='';select.append(empty);
        [...counts].filter(([session])=>session).sort(([a],[b])=>b.localeCompare(a)).forEach(([session,count])=>{const option=node('option',session+' · '+bn(count)+' জন');option.value=session;select.append(option);});
        if(counts.size===1&&[...counts.keys()][0]){select.value=[...counts.keys()][0];sessions.set(level,select.value);}
        if(counts.has(''))label.append(node('small','কিছু শিক্ষার্থীর সেশন নেই; Students-এ সেশন ঠিক করুন।'));
        select.onchange=()=>{sessions.set(level,select.value);rows.filter(row=>row.entry.level===level).forEach(row=>present.delete(row.key));render();};label.append(select);$('daily-sessions').append(label);
      }
      render();
    }catch(error){if(id===requestId){$('daily-print').disabled=true;status(/[\u0980-\u09ff]/.test(error.message)?error.message:'শিক্ষার্থী তালিকা আনা যায়নি। সংযোগ ও Students পড়ার অনুমতি পরীক্ষা করুন।',true);}}
    finally{if(id===requestId)$('daily-load').disabled=false;}
  }
  function prepare(){
    if(!ready())return null;try{validatePresent();}catch(error){status(error.message,true);return null;}
    document.getElementById('daily-print-root')?.remove();const root=node('section');root.id='daily-print-root';
    const page=node('div');page.className='daily-paper';const content=node('div');content.className='daily-paper-content';
    const header=node('header');header.append(node('h1','কুমুদিনী সরকারি কলেজ, টাঙ্গাইল।'),node('div','ভূগোল ও পরিবেশ বিভাগ'),node('div','দৈনিক ক্লাস প্রতিবেদন'));
    const date=node('p','প্রতিবেদন প্রদানের তারিখ : '+bn(loadedDate.split('-').reverse().join('/'))+' খ্রি.');date.className='daily-report-date';
    const footer=node('footer');footer.append(node('div','বিভাগীয় প্রধান'),node('div','ভূগোল ও পরিবেশ বিভাগ'),node('div','কুমুদিনী সরকারি কলেজ, টাঙ্গাইল।'));
    content.append(header,date,table(true),footer);page.append(content);root.append(page);document.body.append(root);fit();return root;
  }
  function fit(){
    const page=document.querySelector('#daily-print-root .daily-paper'),content=page?.firstElementChild;if(!content)return;
    content.style.transform='none';content.style.width='100%';
    const style=getComputedStyle(page),height=page.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),width=page.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    if(width<=0||height<=0)return;
    let scale=1;
    // Keep the table across the paper width when fitting a longer day's report.
    for(let i=0;i<4;i++){scale=Math.max(.01,Math.min(1,(height-2)/Math.max(1,content.scrollHeight)));content.style.width=(width/scale)+'px';}
    scale=Math.min(scale,(height-2)/Math.max(1,content.scrollHeight),width/Math.max(1,content.scrollWidth));
    content.style.transform='scale('+scale+')';
  }
  $('daily-date').value=today();['daily-date','daily-level','daily-teacher'].forEach(id=>$(id).addEventListener('change',()=>invalidate()));
  $('daily-load').onclick=load;$('daily-print').onclick=async()=>{const root=prepare();if(!root)return;await document.fonts?.ready;if(root!==document.getElementById('daily-print-root')||!prepare())return;fit();document.body.classList.add('daily-report-printing');window.print();};
  window.addEventListener('beforeprint',()=>{if(document.body.classList.contains('daily-report-printing'))fit();});
  window.addEventListener('afterprint',()=>document.body.classList.remove('daily-report-printing'));
  window.GeoClassReport={prepare,fit,levelKey,dateDay,roster,setData(next){const key=JSON.stringify(next);if(key===fingerprint)return;fingerprint=key;data=next;options('daily-level',data.levels.map(level=>({value:level,label:level})));options('daily-teacher',data.teachers.map(t=>({value:t.code,label:t.name})));invalidate('রুটিন অনুযায়ী রিপোর্ট পেতে তারিখ বেছে Load report চাপুন।');}};
})();
