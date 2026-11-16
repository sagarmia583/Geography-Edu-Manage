(function(){
  'use strict';
  const data = window.GEO_CLASS_ROUTINE_DATA;
  const byId = id => document.getElementById(id);
  if(!data || !Array.isArray(data.entries) || !Array.isArray(data.courses)){
    byId('result-summary').textContent = 'রুটিনের তথ্য লোড করা যায়নি। পেজটি আবার লোড করুন।';
    document.querySelectorAll('button,select').forEach(control => { control.disabled = true; });
    return;
  }
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if(text !== undefined && text !== null) el.textContent = String(text);
    if(className) el.className = className;
    return el;
  };
  const teacherMap = new Map(data.teachers.map(teacher => [teacher.code,teacher]));
  const levels = ['XI','XII','Degree 1st Year','Degree 2nd Year','Degree 3rd Year','Honours 1st Year','Honours 2nd Year','Honours 3rd Year','Honours 4th Year','Masters'];
  const availableLevels = new Set([...data.entries,...data.courses].map(row => row.level));
  for(const level of availableLevels) if(!levels.includes(level)) levels.push(level);
  const filters = {level:byId('routine-level'),teacher:byId('routine-teacher'),day:byId('routine-day')};
  const unassigned = '__unspecified__';
  const adminPreview=window.GEO_ROUTINE_ADMIN_PREVIEW===true;
  const view=byId('routine-view');
  let appliedFilters=null, loadedView=null;
  let displayedEntries=[],displayedCourses=[];
  const checkReport=adminPreview?window.GeoRoutineChecks.analyze(data):{byEntry:new Map(),groups:[]};
  const teacherNames = codes => (codes || []).map(code => teacherMap.get(code)?.name || code).join(' / ');
  const shortLevel = level => String(level || '').replace('Honours','Hons').replace('Degree','Degree');
  function formatDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || 'Not specified';
    return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
  }
  function option(select,value,label){ const el = node('option',label); el.value = value; select.append(el); }
  levels.filter(level => availableLevels.has(level)).forEach(level => option(filters.level,level,level));
  data.teachers.forEach(teacher => option(filters.teacher,teacher.code,teacher.code+' — '+teacher.name));
  if([...data.entries,...data.courses].some(row => !row.teacherCodes?.length)) option(filters.teacher,unassigned,'Teacher not specified');
  data.days.forEach(day => option(filters.day,day,day));
  const today=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'Asia/Dhaka'}).format(new Date());
  if(!data.days.includes(today))option(filters.day,today,today+' — no scheduled classes');
  byId('effective-date').textContent = formatDate(data.effectiveDate);
  byId('distribution-date').textContent = 'Course distribution: '+formatDate(data.distributionDate);
  byId('routine-description').textContent='Class times, rooms and teachers are shown below. Break: '+data.break.start+'–'+data.break.end+'.';
  const params = new URLSearchParams(location.search);
  for(const [key,select] of Object.entries(filters)) {
    const value = params.get(key) || '';
    if([...select.options].some(item => item.value === value)) select.value = value;
    select.addEventListener('change',selectionChanged);
  }
  function matches(row,includeDay,selected=appliedFilters){
    if(selected.level && row.level !== selected.level) return false;
    if(selected.teacher === unassigned && row.teacherCodes?.length) return false;
    if(selected.teacher && selected.teacher !== unassigned && !(row.teacherCodes || []).includes(selected.teacher)) return false;
    if(includeDay && selected.day && row.day !== selected.day) return false;
    return true;
  }
  function entryItem(entry,compact=false){
    const li = node('li',null,'class-entry');
    li.dataset.entryId=entry.id;
    if(compact){
      if(/^(XI|XII)$/i.test(entry.level.trim()))li.classList.add('routine-higher-secondary','routine-level-'+entry.level.trim().toLowerCase());
      li.append(node('span',window.GeoRoutineFormat.fullEntry(data,entry),'entry-level'));
      const issues=checkReport.byEntry.get(entry.id)||[];
      if(issues.length){li.classList.add('routine-issue');issues.forEach(issue=>li.append(node('div',issue.code+': '+issue.message,'routine-issue-note')));}
      return li;
    }
    if(window.GeoRoutineChecks.isNonMajor(data,entry)){
      li.append(node('span',window.GeoRoutineChecks.nonMajorName(data,entry),'entry-level'));
      return li;
    }
    const showNotes=adminPreview&&window.GeoRoutineChecks.checksEnabled(data,entry);
    const top = node('div',null,'entry-top');
    const selectedCourse=window.GeoRoutinePrint.classSubject(data,entry);
    top.append(node('span',filters.level.value?selectedCourse:shortLevel(entry.level),'entry-level'));
    if(entry.teacherCodes?.length){
      const code = node('span',filters.level.value?teacherNames(entry.teacherCodes):entry.teacherCodes.join('/'),filters.level.value?'entry-teacher-name':'teacher-code');
      code.title = teacherNames(entry.teacherCodes);
      top.append(code);
    }
    li.append(top);
    const details = [];
    if(!filters.level.value && selectedCourse)details.push(selectedCourse);
    if(entry.subject&&window.GeoRoutinePrint.englishText(entry.subject)!==selectedCourse) details.push(window.GeoRoutinePrint.englishText(entry.subject));
    if(entry.room) details.push('Room '+entry.room);
    if(details.length) li.append(node('div',details.join(' · '),'entry-detail'));
    if(showNotes && !entry.teacherCodes?.length) li.append(node('div','শিক্ষক উল্লেখ নেই।','entry-note'));
    if(showNotes && entry.note) li.append(node('div',window.GeoRoutineChecks.noteText(entry.note),'entry-note'));
    if(showNotes && entry.uncertain){
      const label = node('span','মূল তথ্য যাচাই করুন','review-label');
      label.title = window.GeoRoutineChecks.noteText(entry.note);
      li.append(label);
    }
    const issues=checkReport.byEntry.get(entry.id)||[];
    if(issues.length){li.classList.add('routine-issue');issues.forEach(issue=>li.append(node('div',issue.code+': '+issue.message,'routine-issue-note')));}
    if(showNotes && entry.sourceText) li.title = 'Source: '+entry.sourceText;
    return li;
  }
  function entryList(entries,compact=false){
    const ul = node('ul',null,'class-list');
    [...entries].sort(window.GeoRoutineFormat.compareLevels).forEach(entry => ul.append(entryItem(entry,compact)));
    return ul;
  }
  function buildTable(days){
    const table = node('table',null,'timetable');
    table.append(node('caption','Weekly class routine, effective '+formatDate(data.effectiveDate)));
    const head = node('thead'); const row = node('tr');
    const dayHeading = node('th','Day','day-cell'); dayHeading.scope = 'col'; row.append(dayHeading);
    data.periods.forEach((period,index) => {
      const th = node('th',period.label || period.start+'–'+period.end); th.scope = 'col';
      th.append(node('span','Period '+(index+1),'period-index')); row.append(th);
      if(index === data.break.afterPeriod){const br = node('th','Break','break-column');br.scope='col';row.append(br);}
    });
    head.append(row); table.append(head); const body = node('tbody');
    days.forEach((day,dayIndex) => {
      const tr = node('tr');tr.dataset.dayColor=String(data.days.indexOf(day)%5);const th = node('th',day,'day-cell');th.scope='row';tr.append(th);
      data.periods.forEach((period,index) => {
        const td = node('td');const entries = displayedEntries.filter(entry => entry.day === day && entry.period === period.id);
        td.append(entries.length ? entryList(entries,!appliedFilters.level&&!appliedFilters.teacher&&!appliedFilters.day) : node('span','—','no-class'));tr.append(td);
        if(index === data.break.afterPeriod && dayIndex === 0){
          const br = node('td',null,'break-column break-cell');br.rowSpan=days.length;
          br.append(node('span',data.break.start+'–'+data.break.end+' · BREAK'));tr.append(br);
        }
      });
      body.append(tr);
    });
    table.append(body); return table;
  }
  function buildCards(days){
    const fragment = document.createDocumentFragment();
    days.forEach(day => {
      const section = node('section',null,'day-card');section.dataset.dayColor=String(data.days.indexOf(day)%5);section.append(node('h3',day));
      data.periods.forEach((period,index) => {
        const entries = displayedEntries.filter(entry => entry.day === day && entry.period === period.id);
        if(entries.length){
          const row = node('div',null,'period-card');row.append(node('time',period.label || period.start+'–'+period.end),entryList(entries,!appliedFilters.level&&!appliedFilters.teacher&&!appliedFilters.day));section.append(row);
        }
        if(index === data.break.afterPeriod){
          const br = node('div',null,'period-card mobile-break');br.append(node('time',data.break.start+'–'+data.break.end),node('span','Break'));section.append(br);
        }
      });
      fragment.append(section);
    });
    return fragment;
  }
  function buildCourses(){
    const fragment = document.createDocumentFragment();
    levels.forEach(level => {
      const courses = displayedCourses.filter(course => course.level === level); if(!courses.length) return;
      const section = node('section',null,'course-group');section.append(node('h3',level));
      section.dataset.dayColor=String(levels.indexOf(level)%5);
      const wrap = node('div',null,'course-table-wrap');const table = node('table',null,'course-table');
      const thead=node('thead'),header=node('tr');
      [['Code','code-col'],['Course',''],['Assigned teacher','teacher-col']].forEach(([label,cls])=>{const th=node('th',label,cls);th.scope='col';header.append(th);});
      thead.append(header);table.append(thead);const body=node('tbody');
      courses.forEach(course=>{
        const tr=node('tr');tr.append(node('td',course.code || 'No code','code-col'));
        const title=node('td');title.className='course-card-title';title.append(node('strong',window.GeoRoutinePrint.courseTitle(course)));
        if(adminPreview && course.notes) title.append(node('span',course.notes,'course-note'));tr.append(title);
        const teacher=node('td',course.teacherCodes?.join(' / ') || 'Not specified','teacher-col');teacher.dataset.label='Assigned teacher';
        if(course.teacherCodes?.length) teacher.append(node('span',teacherNames(course.teacherCodes),'teacher-name'));
        tr.append(teacher);body.append(tr);
      });
      table.append(body);wrap.append(table);section.append(wrap);fragment.append(section);
    });
    return fragment;
  }
  function render(all=false){
    appliedFilters=Object.fromEntries(Object.entries(filters).map(([key,select])=>[key,select.value]));
    loadedView=all?'all':view.value;
    byId('back-to-today').hidden=adminPreview;
    byId('routine-panel').classList.toggle('routine-filtered',!!(appliedFilters.level||appliedFilters.teacher||appliedFilters.day));
    byId('today-dashboard').hidden=adminPreview;
    byId('routine-panel').hidden=!all&&loadedView!=='routine';
    byId('courses-panel').hidden=!all&&loadedView!=='courses';
    displayedEntries=data.entries.filter(row=>matches(row,true)).sort((a,b)=>window.GeoRoutineFormat.compareEntries(data,a,b));
    displayedCourses=data.courses.filter(row=>row.showInDistribution!==false&&matches(row,false));
    const affected=displayedEntries.filter(e=>checkReport.byEntry.get(e.id)?.length);
    byId('teacher-conflicts').hidden=!affected.length;
    byId('teacher-conflicts').textContent=affected.length?affected.length+'টি ক্লাসে শিক্ষক বা কক্ষের সময়ের সংঘর্ষ অথবা অসম্পূর্ণ তথ্য আছে। লাল নির্দেশনা দেখে যাচাই করুন।':'';
    const selectedDays=data.days.filter(day=>(!filters.day.value || filters.day.value===day) && (!filters.level.value && !filters.teacher.value || displayedEntries.some(entry=>entry.day===day)));
    byId('routine-empty').hidden=displayedEntries.length>0;
    byId('routine-grid').hidden=!displayedEntries.length;byId('routine-cards').hidden=!displayedEntries.length;
    byId('routine-grid').replaceChildren(...(displayedEntries.length?[buildTable(selectedDays)]:[]));
    byId('routine-cards').replaceChildren(...(displayedEntries.length?[buildCards(selectedDays)]:[]));
    byId('course-groups').replaceChildren(buildCourses());byId('courses-empty').hidden=displayedCourses.length>0;
    const teacherLabel=filters.teacher.value===unassigned?'Teacher not specified':teacherMap.get(filters.teacher.value)?.name || 'All teachers';
    const caption=[filters.level.value || 'All levels',teacherLabel];
    byId('filter-caption').textContent=(loadedView==='courses'?caption:[...caption,filters.day.value || data.days.join(', ')]).join(' · ');
    byId('filter-caption').dataset.courseCaption=caption.join(' · ')+' · Course distribution '+formatDate(data.distributionDate);
    byId('result-summary').textContent=all?displayedEntries.length+' class entries · '+displayedCourses.length+' course allocations':loadedView==='routine'?displayedEntries.length+' class entries':displayedCourses.length+' course allocations';
    ['print-routine','export-routine','download-routine'].forEach(id=>{byId(id).disabled=!displayedEntries.length;});
    ['print-courses','export-courses','download-courses'].forEach(id=>{byId(id).disabled=!displayedCourses.length;});
    const url=new URL(location.href);url.searchParams.set('view',view.value);
    for(const [key,select] of Object.entries(filters)) select.value?url.searchParams.set(key,select.value):url.searchParams.delete(key);
    try{history.replaceState(null,'',url);}catch(e){/* Filters also work when opened from a local file. */}
  }
  function csvCell(value){
    let text=String(value ?? '');
    if(/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function downloadCSV(name,rows){
    const text='\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
    const anchor=node('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  byId('export-routine').addEventListener('click',()=>downloadCSV('Geography-Class-Routine-'+data.effectiveDate+'.csv',[
    ['Effective date','Day','Time','Level','Teacher code','Teacher name','Room','Course name','Class details',...(adminPreview?['Notes','Needs confirmation','Source text']:[])],
    ...displayedEntries.map(entry=>{const period=data.periods.find(item=>item.id===entry.period)||{},nonMajor=window.GeoRoutineChecks.isNonMajor(data,entry),showNotes=window.GeoRoutineChecks.checksEnabled(data,entry);return [data.effectiveDate,entry.day,period.label,entry.level,nonMajor?'':entry.teacherCodes?.join('/'),nonMajor?'':teacherNames(entry.teacherCodes),nonMajor?'':entry.room,window.GeoRoutinePrint.courseName(data,entry),nonMajor?window.GeoRoutineChecks.nonMajorName(data,entry):window.GeoRoutinePrint.englishText(entry.subject),...(adminPreview?(showNotes?[entry.note,entry.uncertain?'Yes':'No',entry.sourceText]:['','','']):[])];})
  ]));
  byId('export-courses').addEventListener('click',()=>downloadCSV('Geography-Course-Distribution-'+data.distributionDate+'.csv',[
    ['Distribution date','Level','Code','Course','Teacher code','Teacher name',...(adminPreview?['Notes']:[])],
    ...displayedCourses.map(course=>[data.distributionDate,course.level,course.code,window.GeoRoutinePrint.courseTitle(course),course.teacherCodes?.join('/'),teacherNames(course.teacherCodes),...(adminPreview?[course.notes]:[])])
  ]));
  window.GeoRoutinePrint.configure(section=>appliedFilters?({data,entries:displayedEntries,courses:displayedCourses,filters:appliedFilters,adminPreview,section:loadedView==='all'?section:loadedView}):null);
  function print(section){
    const result=window.GeoRoutinePrint.print(section);
    if(result?.catch)result.catch(error=>{byId('routine-export-status').textContent=error.message;});
  }
  for(const section of ['routine','courses'])byId('download-'+section).addEventListener('click',async()=>{
    const controls=[...document.querySelectorAll('button,select,input')].map(el=>[el,el.disabled]);
    controls.forEach(([el])=>el.disabled=true);byId('routine-export-status').textContent='PDF তৈরি হচ্ছে…';
    try{await window.GeoRoutinePDF.download(section);byId('routine-export-status').textContent='PDF download প্রস্তুত হয়েছে।';}
    catch(error){byId('routine-export-status').textContent=/[\u0980-\u09ff]/.test(error.message)?error.message:'PDF তৈরি হয়নি। পেজ Reload করে আবার চেষ্টা করুন।';}
    finally{controls.forEach(([el,disabled])=>el.disabled=disabled);}
  });
  byId('print-routine').addEventListener('click',()=>print('routine'));
  byId('print-courses').addEventListener('click',()=>print('courses'));
  window.addEventListener('afterprint',()=>document.body.classList.remove('print-target-routine','print-target-courses'));

  function pendingSelection(){
    byId('back-to-today').hidden=true;
    byId('today-dashboard').hidden=false;
    appliedFilters=null;loadedView=null;displayedEntries=[];displayedCourses=[];
    byId('routine-panel').hidden=true;byId('courses-panel').hidden=true;
    ['routine-grid','routine-cards','course-groups'].forEach(id=>byId(id).replaceChildren());
    ['print-routine','export-routine','download-routine','print-courses','export-courses','download-courses'].forEach(id=>byId(id).disabled=true);
    byId('result-summary').textContent='Choose a view and filters, then click Load.';
    byId('filter-caption').textContent='';
    byId('teacher-conflicts').hidden=true;
  }
  let liveKey='';
  function selectionChanged(){
    liveKey='';
    const courses=view.value==='courses';
    document.querySelectorAll('[data-student-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.studentView===view.value)));
    const extraSelection=[filters.teacher.value,...(!courses?[filters.day.value]:[])].filter(Boolean).join(' · ');
    byId('extra-filters').querySelector('summary').textContent=(courses?'Filter by teacher':'Teacher & day filters')+(extraSelection?' · '+extraSelection:'');
    byId('routine-day-label').hidden=courses;
    byId('load-view').textContent=courses?'Load course distribution':'Load routine';
    if(adminPreview)render();else pendingSelection();
    renderToday();
  }
  function renderToday(){
    if(adminPreview)return;
    const now=new Date();
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',weekday:'long',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
    const minute=Number(parts.hour)*60+Number(parts.minute);
    const minutes=time=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
    const selected={level:filters.level.value,teacher:filters.teacher.value};
    const entries=data.entries.filter(e=>e.day===parts.weekday&&matches(e,false,selected));
    const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
    const effective=[dateParts.year,dateParts.month,dateParts.day].join('-')>=data.effectiveDate;
    const current=entries.filter(e=>{const p=data.periods.find(p=>p.id===e.period);return p&&minute>=minutes(p.start)&&minute<minutes(p.end);});
    byId('routine-clock').textContent=parts.weekday+' · '+parts.hour+':'+parts.minute+':'+parts.second+' (Bangladesh time)';
    byId('today-scope').textContent=[selected.level||'All levels',teacherMap.get(selected.teacher)?.name||(selected.teacher?'Teacher not specified':'All teachers')].join(' · ');
    const base=Date.UTC(Number(dateParts.year),Number(dateParts.month)-1,Number(dateParts.day));
    const targetTime=(offset,time)=>base-6*3600000+offset*86400000+minutes(time)*60000;
    function updateTimers(){
      byId('today-dashboard').querySelectorAll('[data-countdown-to]').forEach(timer=>{
        const seconds=Math.max(0,Math.ceil((Number(timer.dataset.countdownTo)-now.getTime())/1000));
        const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),mins=Math.floor(seconds%3600/60),secs=seconds%60;
        timer.textContent=(days?days+'d ':'')+[hours,mins,secs].map(n=>String(n).padStart(2,'0')).join(':');
      });
      byId('today-dashboard').querySelectorAll('progress[data-start]').forEach(progress=>{progress.value=Math.max(0,Math.min(progress.max,(now.getTime()-Number(progress.dataset.start))/1000));});
    }
    // Tick only the clock, countdown text and progress. Preserve cards and scroll
    // positions until the minute/scope changes instead of rebuilding every second.
    const key=[base,minute,selected.level,selected.teacher].join('|');
    if(key===liveKey){updateTimers();return;}liveKey=key;
    function countdown(container,label,target,duration){
      const box=node('div',null,'live-timer');box.append(node('span',label,'live-timer-label'));
      const digits=node('strong',null,'live-digits');digits.dataset.countdownTo=String(target);digits.setAttribute('aria-label',label);digits.setAttribute('aria-live','off');box.append(digits,node('span',duration+' minute class','live-duration'));container.append(box);
    }
    function liveList(group){
      const list=node('ul',null,'live-class-list');
      [...group].sort(window.GeoRoutineFormat.compareLevels).forEach(entry=>{
        const item=node('li',null,'live-class-card');item.dataset.entryId=entry.id;item.classList.add('class-entry');
        const nonMajor=window.GeoRoutineChecks.isNonMajor(data,entry);
        const course=window.GeoRoutineSubjects?.courseFor(data,entry);
        item.append(node('span',shortLevel(entry.level),'live-level'));
        item.append(node('strong',window.GeoRoutinePrint.courseTitle(course)||window.GeoRoutinePrint.classSubject(data,entry)||'Course not selected','live-subject'));
        if(course?.code)item.append(node('span','Code: '+course.code,'live-course-code'));
        if(!nonMajor&&entry.teacherCodes.length)item.append(node('span',teacherNames(entry.teacherCodes),'live-teacher'));
        if(entry.room)item.append(node('span','Room '+entry.room,'live-room'));
        list.append(item);
      });return list;
    }
    function show(id,rows,empty){
      const container=byId(id);container.replaceChildren();
      if(!effective){container.append(node('p','This routine takes effect on '+formatDate(data.effectiveDate)+'.','empty-state'));return;}
      if(!rows.length){container.append(node('p',empty,'empty-state'));return;}
      [...data.periods].sort((a,b)=>minutes(a.start)-minutes(b.start)).forEach(period=>{
        const group=rows.filter(e=>e.period===period.id);if(!group.length)return;
        const block=node('div',null,'today-period');
        block.append(node('h4',period.start+'–'+period.end));
        if(id==='day-classes'){
          block.dataset.period=String(period.id);
          const status=minute>=minutes(period.end)?'Completed':minute>=minutes(period.start)?'Ongoing':'Upcoming';
          block.dataset.status=status.toLowerCase();
          block.append(node('span',status,'today-status'));
        }
        if(id==='now-classes'){
          const duration=minutes(period.end)-minutes(period.start);
          countdown(block,'Time remaining',targetTime(0,period.end),duration);
          const progress=node('progress');progress.max=duration*60;progress.dataset.start=String(targetTime(0,period.start));progress.setAttribute('aria-label','Class elapsed time');block.append(progress);
        }
        block.append(liveList(group));container.append(block);
      });
    }
    show('now-classes',current,'No classes are running now.');
    const onBreak=effective&&entries.length&&!current.length&&minute>=minutes(data.break.start)&&minute<minutes(data.break.end);
    if(onBreak){
      const container=byId('now-classes'),card=node('div',null,'snack-break');
      const art=node('div',null,'snack-scene');art.setAttribute('aria-hidden','true');
      for(let i=0;i<3;i++)art.append(node('span',null,'tea-steam steam-'+i));
      art.append(node('span',null,'tea-cup'),node('span',null,'tea-saucer'),node('span',null,'snack-cookie'));
      card.append(art,node('strong','Time for a little break','break-title'),node('p','Grab a snack, sip some tea, and recharge.','break-caption'),node('p',data.break.start+'–'+data.break.end,'break-hours'));
      countdown(card,'Break ends in',targetTime(0,data.break.end),minutes(data.break.end)-minutes(data.break.start));
      card.querySelector('.live-duration').textContent='Back to the routine soon';
      container.replaceChildren(card);
    }
    show('day-classes',entries,'No classes are scheduled today.');
    // Search the weekly schedule in Dhaka calendar time, including weekends and
    // the first effective date. A syllabus alone never invents a timetable slot.
    const next=byId('next-classes');next.replaceChildren();
    const effectiveDay=Date.parse(data.effectiveDate+'T00:00:00Z');
    const firstDay=Math.max(0,Math.ceil((effectiveDay-base)/86400000));
    let upcoming=null;
    for(let offset=firstDay;offset<=firstDay+7&&!upcoming;offset++){
      const dayDate=new Date(base+offset*86400000),day=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(dayDate);
      for(const period of data.periods){
        if(offset===0&&minutes(period.start)<=minute)continue;
        const group=data.entries.filter(e=>e.day===day&&e.period===period.id&&matches(e,false,selected));
        if(group.length){upcoming={offset,dayDate,day,period,group};break;}
      }
    }
    if(upcoming){
      const {offset,dayDate,day,period,group}=upcoming;
      const label=offset===0?'Today':offset===1?'Tomorrow':day+' · '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(dayDate);
      next.append(node('p',label+' · '+period.start+'–'+period.end,'next-time'));
      const duration=minutes(period.end)-minutes(period.start);
      countdown(next,'Starts in',targetTime(offset,period.start),duration);next.append(liveList(group));
    }else next.append(node('p','No upcoming classes match this selection.','empty-state'));
    byId('now-heading').classList.toggle('is-live',effective&&current.length>0);
    updateTimers();
  }
  function loadSelected(){render();byId(loadedView==='routine'?'routine-panel':'courses-panel').scrollIntoView?.({behavior:'smooth',block:'start'});}
  byId('load-view').addEventListener('click',loadSelected);
  document.querySelectorAll('[data-student-view]').forEach(button=>button.addEventListener('click',()=>{view.value=button.dataset.studentView;selectionChanged();loadSelected();}));
  byId('load-full-routine').addEventListener('click',()=>{Object.values(filters).forEach(select=>select.value='');view.value='routine';selectionChanged();loadSelected();});
  byId('back-to-today').addEventListener('click',()=>{pendingSelection();renderToday();byId('today-dashboard').scrollIntoView?.({behavior:'smooth',block:'start'});});
  view.addEventListener('change',selectionChanged);
  byId('reset-filters').addEventListener('click',()=>{Object.values(filters).forEach(select=>select.value='');selectionChanged();});
  byId('today-classes').addEventListener('click',()=>{
    const day=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'Asia/Dhaka'}).format(new Date());
    if(![...filters.day.options].some(o=>o.value===day))option(filters.day,day,day);
    filters.day.value=day;view.value='routine';selectionChanged();loadSelected();
  });
  if(params.get('view')==='courses')view.value='courses';
  if(filters.teacher.value||filters.day.value)byId('extra-filters').open=true;
  byId('today-dashboard').hidden=adminPreview;
  selectionChanged();
  if(!adminPreview){
    // The live dashboard comes first; both published reference sections are below it.
    if(params.get('view')==='courses')render();else render(true);
    let clockTimer=setInterval(renderToday,1000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderToday();});
    window.addEventListener('pagehide',()=>{clearInterval(clockTimer);clockTimer=null;});
    window.addEventListener('pageshow',()=>{renderToday();if(clockTimer===null)clockTimer=setInterval(renderToday,1000);});
  }
})();
