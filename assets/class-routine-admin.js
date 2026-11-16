(function(){
  'use strict';
  if(!requireAuth('admin')) return;
  attachLogout();
  const store=window.GeoRoutineStore,$=id=>document.getElementById(id);
  let data=null,revision=0,publishedRevision=0,dirty=false,busy=false,settingsPending=false,previewReady=false,previewSnapshot='',mode='',editId='',oldTeacherCode='',view='classes';
  let layout='board',formRowId='';
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const message=(text,error=false)=>{$('admin-status').textContent=text;$('admin-status').dataset.error=error;};
  function state(){
    $('editor').disabled=busy||!data;
    $('row-form').querySelectorAll('input,select,textarea,button').forEach(control=>control.disabled=busy);
    $('save-row').textContent=busy?'Saving…':mode==='entries'?'Save class':'Save course';
    $('reload-draft').disabled=busy;
    $('save-draft').disabled=busy||!data||!dirty||settingsPending;
    $('save-print-assets').disabled=busy||!data||!dirty||settingsPending;
    $('preview-draft').disabled=busy||!data||settingsPending;
    $('publish-draft').disabled=busy||!data||dirty||settingsPending||!previewReady||previewSnapshot!==JSON.stringify(data)||publishedRevision===revision;
    $('dirty-state').textContent=settingsPending?'Apply settings to draft first':dirty?'Unsaved draft changes':data?'Draft saved':'';
    $('version-info').textContent=data?'Draft revision '+revision+' · Published revision '+(publishedRevision||'unknown'):'';
    $('report-source').textContent=data?'Source: current routine draft · Revision '+revision+(dirty?' · Includes unsaved changes':' · Saved draft')+'. Scheduled classes only; this report does not record attendance or completed classes.':'';
    if(data)window.GeoClassReport?.setData(data,revision,dirty);
    $('workflow-help').textContent=!data?'Routine লোড হলে কাজ শুরু করতে পারবেন।':settingsPending?'Settings পরিবর্তন করেছেন। Apply settings to draft চাপুন।':dirty?'পরিবর্তন এখনো save হয়নি। 1. Save draft চাপুন।':publishedRevision===revision?'এই saved routine শিক্ষার্থীরা দেখতে পাচ্ছে। পরিবর্তন করতে নিচে Edit চাপুন।':previewReady?'Preview দেখা হয়েছে। 3. Publish করলে শিক্ষার্থীরা নতুন routine দেখবে।':'Draft saved আছে। 2. Preview খুলে দেখে তারপর Publish করুন।';
  }
  const courseTitle=c=>window.GeoRoutineSubjects?.title(c)??c?.title??"";
  const courseFor=e=>window.GeoRoutineSubjects?.courseFor(data,e)??data.courses.find(c=>c.id===e.courseId);
  const yearCourses=()=>window.GeoRoutineSubjects?.courses(data,$('row-level').value)??data.courses.filter(c=>c.level===$('row-level').value);
  const changed=()=>{data.effectiveDate=store.effectiveDateToday();$('effective').value=data.effectiveDate;dirty=true;previewReady=false;previewSnapshot='';state();};
  function options(el,items,selected,blank){
    el.replaceChildren();if(blank!==undefined){const op=node('option',blank);op.value='';el.append(op);}
    items.forEach(item=>{const op=node('option',item.label??item);op.value=item.value??item;el.append(op);});
    if(selected!==undefined)el.value=String(selected);
  }
  function populate(){
    options($('edit-level'),data.levels,$('edit-level').value,'All levels');
    options($('edit-teacher'),data.teachers.map(t=>({value:t.code,label:t.code+' — '+t.name})),$('edit-teacher').value,'All teachers');
    options($('edit-day'),data.days,$('edit-day').value,'All days');
    options($('edit-period'),data.periods.map(p=>({value:p.id,label:p.label})),$('edit-period').value,'All times');
    $('effective').value=data.effectiveDate;$('distribution').value=data.distributionDate;
    $('days').value=data.days.join(', ');$('levels').value=data.levels.join(', ');
    $('break-start').value=data.break.start;$('break-end').value=data.break.end;$('routine-notes').value=data.notes.join('\n');
    $('period-settings').replaceChildren();
    data.periods.forEach((p,i)=>{for(const key of ['start','end']){const label=node('label','Period '+(i+1)+' '+key),input=node('input');input.type='time';input.required=true;input.id='period-'+i+'-'+key;input.value=p[key];label.append(input);$('period-settings').append(label);}});
    renderBranding();render();state();
  }
  function renderBranding(){
    for(const kind of ['signature','seal']){
      const image=$(kind+'-preview'),src=data?.printAssets?.[kind];
      image.hidden=!src;if(src)image.src=src;else image.removeAttribute('src');
      $('remove-'+kind).disabled=!src;
    }
  }
  function matches(row){
    const query=$('editor-search').value.trim().toLowerCase();
    const text=[row.level,row.day,row.room,row.subject,row.title,row.code,courseTitle(courseFor(row)),...row.teacherCodes,...row.teacherCodes.map(code=>data.teachers.find(t=>t.code===code)?.name)].filter(Boolean).join(' ').toLowerCase();
    return (!query||text.includes(query))&&(!$('edit-level').value||row.level===$('edit-level').value)&&(!$('edit-teacher').value||row.teacherCodes.includes($('edit-teacher').value))&&(!row.day||!$('edit-day').value||row.day===$('edit-day').value)&&(!row.day||$('edit-period').value===''||String(row.period)===$('edit-period').value);
  }
  function showView(next){
    view=next;
    document.querySelectorAll('[data-routine-panel]').forEach(panel=>panel.hidden=panel.dataset.routinePanel!==view);
    document.querySelectorAll('[data-routine-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.routineView===view)));
    $('editor-filters').hidden=!['classes','courses'].includes(view);$('edit-day-label').hidden=view!=='classes';
    $('edit-period-label').hidden=view!=='classes';
    $('editor-count').hidden=!['classes','courses'].includes(view);if(data)render();
    $('editor-search-label').hidden=!['classes','courses'].includes(view);
  }
  function actionCell(row,type){
    const td=node('td'),edit=node('button','Edit'),remove=node('button','Remove');edit.type=remove.type='button';
    edit.addEventListener('click',()=>openRow(type,row));
    remove.addEventListener('click',()=>{if(settingsPending)return message('আগে সেটিংস খসড়ায় প্রয়োগ করুন।',true);if(type==='courses'&&data.entries.some(e=>e.courseId===row.id))return message('এই কোর্স রুটিনের ক্লাসে বাছাই করা আছে। আগে ক্লাস সম্পাদনা করে কোর্স বদলান বা ফাঁকা করুন।',true);if(!confirm('এই '+(type==='entries'?'class':'course')+' draft থেকে বাদ দেবেন? Publish না করা পর্যন্ত student routine বদলাবে না।'))return;data[type]=data[type].filter(r=>r.id!==row.id);changed();render();});
    td.append(edit,remove);return td;
  }
  function render(){
    const report=window.GeoRoutineChecks.analyze(data);
    $('class-rows').replaceChildren();$('course-rows').replaceChildren();
    const teacherNames=codes=>codes.map(code=>data.teachers.find(t=>t.code===code)?.name||code).join(' / ')||'Not specified';
    renderReport();
    renderBoard(report,teacherNames);
    data.entries.filter(matches).sort((a,b)=>window.GeoRoutineFormat.compareEntries(data,a,b)).forEach(e=>{const tr=node('tr'),p=data.periods.find(p=>p.id===e.period);[e.day+' · '+p.label,e.level,window.GeoRoutineChecks.isNonMajor(data,e)?'':teacherNames(e.teacherCodes),window.GeoRoutineChecks.isNonMajor(data,e)?window.GeoRoutineChecks.nonMajorName(data,e):[e.room,courseTitle(courseFor(e)),e.subject].filter(Boolean).join(' · ')].forEach(v=>tr.append(node('td',v)));const issues=report.byEntry.get(e.id)||[];if(issues.length){tr.classList.add('routine-issue');issues.forEach(issue=>tr.lastElementChild.append(node('div',issue.code+': '+issue.message,'routine-issue-note')));}const preview=node('td',window.GeoRoutineFormat.fullEntry(data,e));preview.className='routine-row-preview';if(/^(XI|XII)$/i.test(e.level.trim()))preview.classList.add('routine-higher-secondary','routine-level-'+e.level.trim().toLowerCase());preview.title='Full Routine preview';tr.append(preview,actionCell(e,'entries'));$('class-rows').append(tr);});
    data.courses.filter(matches).forEach(c=>{const tr=node('tr');[c.level,c.code,courseTitle(c),teacherNames(c.teacherCodes)].forEach(v=>tr.append(node('td',v)));if(c.showInDistribution===false)tr.cells[2].append(node('small',' — Hidden from Course Distribution'));tr.append(actionCell(c,'courses'));$('course-rows').append(tr);});
    const rows=view==='courses'?data.courses:data.entries;$('editor-count').textContent=rows.filter(matches).length+' / '+rows.length+' '+(view==='courses'?'courses':'classes')+' দেখানো হচ্ছে';
    for(const id of ['class-rows','course-rows'])if(!$(id).children.length){const tr=node('tr'),td=node('td','No rows for this filter.');td.colSpan=id==='class-rows'?6:5;tr.append(td);$(id).append(tr);}
    const issues=report.groups;
    $('conflict-summary').textContent=issues.length?issues.length+'টি Honours major ক্লাসের সমস্যা বা তথ্য যাচাই প্রয়োজন — বিস্তারিত দেখুন':'Honours major ক্লাসে শিক্ষক বা কক্ষের সংঘর্ষ বা অসম্পূর্ণ তথ্য পাওয়া যায়নি';
    $('conflict-count').replaceChildren();issues.forEach(issue=>$('conflict-count').append(node('p',issue.code+': '+issue.message,'routine-issue-note')));
    $('conflict-summary').classList.toggle('routine-issue-note',!!issues.length);
    $('admin-teachers').replaceChildren();
    data.teachers.forEach(t=>{const card=node('article');card.className='teacher-card';card.append(node('h3',t.code+' — '+t.name),node('p',t.designation));const edit=node('button','Edit'),remove=node('button','Remove');edit.type=remove.type='button';edit.onclick=()=>openTeacher(t);remove.onclick=()=>{if(settingsPending)return message('আগে সেটিংস খসড়ায় প্রয়োগ করুন।',true);if([...data.entries,...data.courses].some(r=>r.teacherCodes.includes(t.code)))return message('আগে এই শিক্ষকের ক্লাস ও কোর্সের দায়িত্ব পরিবর্তন করুন।',true);if(confirm('Teacher '+t.code+' draft থেকে বাদ দেবেন?')){data.teachers=data.teachers.filter(x=>x.code!==t.code);changed();populate();}};card.append(edit,remove);$('admin-teachers').append(card);});
  }
  function renderReport(){
    const entries=data.entries.filter(matches),days=data.days.filter(day=>!$('edit-day').value||day===$('edit-day').value);
    $('report-total').textContent=String(entries.length);
    $('report-levels').textContent=String(new Set(entries.map(e=>e.level)).size);
    $('report-teachers').textContent=String(new Set(entries.flatMap(e=>e.teacherCodes)).size);
    $('report-unassigned').textContent=String(entries.filter(e=>!e.teacherCodes.length).length);
    $('report-selection').textContent=[$('edit-level').value||'All levels',$('edit-teacher').selectedOptions[0]?.textContent||'All teachers',$('edit-day').value||'All days',$('edit-period').value!==''?$('edit-period').selectedOptions[0].textContent:'All times',$('editor-search').value.trim()?'Search: '+$('editor-search').value.trim():''].filter(Boolean).join(' · ');
    function table(id,heading,groups){
      const table=$(id);table.replaceChildren();const thead=node('thead'),header=node('tr');
      [heading,...days,'Total classes'].forEach(label=>{const cell=node('th',label);cell.scope='col';header.append(cell);});thead.append(header);table.append(thead);
      const tbody=node('tbody');
      groups.forEach(group=>{const row=node('tr'),title=node('th',group.label);title.scope='row';row.append(title);days.forEach(day=>row.append(node('td',String(group.entries.filter(e=>e.day===day).length))));row.append(node('td',String(group.entries.length)));tbody.append(row);});
      if(!groups.length){const row=node('tr'),cell=node('td','No classes match these filters.');cell.colSpan=days.length+2;row.append(cell);tbody.append(row);}
      table.append(tbody);
    }
    const teachers=data.teachers.filter(t=>!$('edit-teacher').value||t.code===$('edit-teacher').value).map(t=>({label:t.name+' ('+t.code+')',entries:entries.filter(e=>e.teacherCodes.includes(t.code))})).filter(group=>group.entries.length);
    const unassigned=entries.filter(e=>!e.teacherCodes.length);if(unassigned.length)teachers.push({label:'Teacher not assigned',entries:unassigned});
    table('report-teacher-table','Teacher',teachers);
    table('report-level-table','Academic level',data.levels.map(level=>({label:level,entries:entries.filter(e=>e.level===level)})).filter(group=>group.entries.length));
    table('report-day-table','All selected classes',[{label:'Total scheduled classes',entries}]);
  }
  function renderBoard(report,teacherNames){
    const board=$('class-board');board.replaceChildren();
    const visible=data.entries.filter(matches);
    if(!visible.length)board.append(node('p','No matching classes. Adjust the filters or add a class.'));
    const byTime=layout==='time';
    const groups=byTime?data.periods.filter(p=>$('edit-period').value===''||String(p.id)===$('edit-period').value).map(p=>({key:p.id,label:p.label})):data.days.filter(day=>!$('edit-day').value||$('edit-day').value===day).map(day=>({key:day,label:day}));
    groups.forEach(group=>{
      const entries=visible.filter(e=>byTime?e.period===group.key:e.day===group.key).sort((a,b)=>window.GeoRoutineFormat.compareEntries(data,a,b));
      const section=node('section'),heading=node('div'),list=node('div');section.className='editor-day';heading.className='editor-day-heading';list.className='editor-day-classes';
      heading.append(node('h3',group.label+' · '+entries.length));
      const add=node('button','+ Add');add.type='button';add.setAttribute('aria-label','Add class '+(byTime?'at ':'on ')+group.label);add.onclick=()=>{if(busy)return;if(settingsPending)return message('আগে সেটিংস খসড়ায় প্রয়োগ করুন।',true);openRow('entries');if(byTime)$('row-period').value=String(group.key);else $('row-day').value=group.key;updateRowContext();};heading.append(add);section.append(heading,list);
      entries.forEach(entry=>{
        const period=data.periods.find(p=>p.id===entry.period),button=node('button');button.type='button';button.className='editor-class-card';button.dataset.entryId=entry.id;
        button.setAttribute('aria-label','Edit '+entry.day+' '+period.label+' '+entry.level);
        button.append(node('strong',byTime?entry.day+' · '+period.label:period.label),node('span',entry.level));
        if(window.GeoRoutineChecks.isNonMajor(data,entry))button.append(node('b',window.GeoRoutineChecks.nonMajorName(data,entry)));
        else button.append(node('b',courseTitle(courseFor(entry))||entry.subject||'Course not selected'),node('span',teacherNames(entry.teacherCodes)),node('span',entry.room?'Room '+entry.room:'Room not specified'));
        const issues=report.byEntry.get(entry.id)||[];
        if(issues.length){button.classList.add('routine-issue');button.append(node('small',issues.length+'টি তথ্য যাচাই প্রয়োজন'));}
        const editHint=node('span','Edit class →');editHint.className='editor-card-action';button.append(editHint);
        button.onclick=()=>openRow('entries',entry);list.append(button);
      });
      if(!entries.length)list.append(node('p','No classes'));board.append(section);
    });
  }
  function updateRowContext(){
    $('row-context').textContent=mode==='entries'?[$('row-level').value,$('row-day').value,$('row-period').selectedOptions[0]?.textContent].filter(Boolean).join(' · '):$('row-level').value;
  }
  async function load(){
    if((dirty||settingsPending)&&!confirm('Unsaved changes বাদ দিয়ে saved draft আনবেন?'))return;
    busy=true;state();message('Loading saved draft…');
    try{const saved=await store.draft();data=store.clone(saved.document);await window.GeoRoutineSubjects?.load(data);revision=saved.revision;dirty=false;settingsPending=false;previewReady=false;previewSnapshot='';
      try{const live=await store.published();publishedRevision=live.revision;data.effectiveDate=publishedRevision===revision?live.document.effectiveDate:store.effectiveDateToday();}catch(error){publishedRevision=0;data.effectiveDate=store.effectiveDateToday();}
      populate();message('খসড়া লোড হয়েছে। দিন বা সময় বেছে ক্লাসে ক্লিক করুন। Save class চাপলেই এন্ট্রিটি সরাসরি ডেটাবেসের খসড়ায় সংরক্ষিত হবে।');
    }catch(error){message(store.errorText(error),true);}finally{busy=false;state();}
  }
  function openRow(type,row){
    if(busy)return;
    if(settingsPending)return message('আগে সেটিংস খসড়ায় প্রয়োগ করুন।',true);
    mode=type;editId=row?.id||'';$('row-error').textContent='';$('row-form').reset();
    formRowId=editId||crypto.randomUUID();
    $('row-title').textContent=(row?'Edit ':'Add ')+(type==='entries'?'class':'course');
    document.querySelectorAll('.class-only').forEach(el=>el.hidden=type!=='entries');
    document.querySelectorAll('.course-only').forEach(el=>el.hidden=type!=='courses');
    options($('row-level'),data.levels,row?.level||$('edit-level').value||data.levels[0]);options($('row-day'),data.days,row?.day||$('edit-day').value||data.days[0]);
    options($('row-period'),data.periods.map(p=>({value:p.id,label:p.label})),row?.period??($('edit-period').value!==''?Number($('edit-period').value):data.periods[0].id));
    $('row-teacher-options').replaceChildren();
    data.teachers.forEach(t=>{const label=node('label'),box=node('input');box.type='checkbox';box.value=t.code;box.checked=row?row.teacherCodes.includes(t.code):$('edit-teacher').value===t.code;label.append(box,document.createTextNode(t.name+' ('+t.code+')'));$('row-teacher-options').append(label);});
    $('row-room').value=row?.room||'';$('row-code').value=row?.code||'';$('row-detail').value=row?.subject||row?.title||'';
    $('row-section').value=row&&Object.prototype.hasOwnProperty.call(row,'section')?row.section:window.GeoRoutineFormat.section(row||{level:$('row-level').value});
    sectionField();
    $('row-distribution-visible').checked=row?.showInDistribution!==false;
    catalogOptions();
    $('row-detail').required=type==='courses';$('row-note').value=row?.note||row?.notes||'';$('row-uncertain').checked=!!row?.uncertain;
    courseOptions(row?.courseId||'');
    updateRowContext();
    state();
    $('row-dialog').showModal();
  }
  function courseOptions(selected=''){
    options($('row-course'),yearCourses().map(c=>({value:c.id,label:[c.code,courseTitle(c)].filter(Boolean).join(' — ')})),selected,'Auto — rotate assigned courses');
    renderCourseChoices();
  }
  function sectionField(){
    $('row-section-label').hidden=mode!=='entries'||!['XI','XII'].includes($('row-level').value);
  }
  function catalogOptions(){
    const list=window.GeoRoutineSubjects?.list($('row-level').value)||[];
    options($('row-catalog'),list.map(c=>({value:c.code,label:c.code+' — '+c.title})),$('row-code').value,'Select from Subjects (year-wise)');
    $('catalog-help').textContent=list.length?list.length+'টি বিষয় Subjects থেকে এসেছে। বিষয় বেছে শিক্ষক নির্বাচন করুন।':'এই বর্ষের Subjects লোড হয়নি বা তালিকা খালি। সংরক্ষিত তথ্য ব্যবহার করা যাবে।';
  }
  $('row-catalog').addEventListener('change',()=>{
    const subject=window.GeoRoutineSubjects?.list($('row-level').value).find(c=>c.code===$('row-catalog').value);
    if(subject){$('row-code').value=subject.code;$('row-detail').value=subject.title;}
  });
  function renderCourseChoices(){
    const selected=$('row-course').value;
    const teacherCodes=[...$('row-teacher-options').querySelectorAll('input:checked')].map(input=>input.value);
    const courses=yearCourses();
    const assigned=c=>c.teacherCodes.some(code=>teacherCodes.includes(code));
    const matched=courses.filter(assigned);
    $('course-choice-help').textContent=courses.length?`এই বর্ষের ${courses.length}টি কোর্স আছে। নির্বাচিত শিক্ষকের দায়িত্বে ${matched.length}টি। Auto রাখলে দিন ও সময় অনুযায়ী assigned course পালা করে আসবে। নির্দিষ্ট কোর্স চাইলে এখানে বেছে নিন।`:'এই বর্ষের বিষয় পাওয়া যায়নি। Subjects ও Course Distribution-এর তথ্য পরীক্ষা করুন।';
    const list=$('course-choices');list.replaceChildren();
    [...courses].sort((a,b)=>Number(assigned(b))-Number(assigned(a))).forEach(course=>{
      const button=node('button');button.type='button';button.dataset.courseId=course.id;
      button.setAttribute('aria-pressed',String(course.id===selected));
      button.append(node('strong',[course.code,courseTitle(course)].filter(Boolean).join(' — ')));
      button.append(node('span',course.teacherCodes.map(code=>data.teachers.find(t=>t.code===code)?.name||code).join(' / ')||'Teacher not assigned'));
      if(assigned(course))button.append(node('small','Assigned to selected teacher'));
      button.onclick=()=>{if(busy)return;$('row-course').value=course.id;renderCourseChoices();};list.append(button);
    });
    const course=courses.find(c=>c.id===selected);
    $('selected-course').textContent=course?'Selected course: '+courseTitle(course):'Auto: rotate this teacher’s assigned courses for this year';
  }
  $('row-level').addEventListener('change',()=>{courseOptions();catalogOptions();sectionField();if(mode==='courses'){$('row-code').value='';$('row-detail').value='';$('row-catalog').value='';}updateRowContext();});
  $('row-course').addEventListener('change',renderCourseChoices);
  $('row-teacher-options').addEventListener('change',renderCourseChoices);
  ['row-day','row-period'].forEach(id=>$(id).addEventListener('change',updateRowContext));
  $('row-form').onsubmit=async e=>{
    e.preventDefault();
    if(busy)return;
    $('row-error').textContent='';
    try{
      const next=store.clone(data),old=next[mode].find(r=>r.id===editId)||{};
      const row={...old,id:formRowId,level:$('row-level').value,teacherCodes:[...$('row-teacher-options').querySelectorAll('input:checked')].map(op=>op.value)};
      if(mode==='entries')Object.assign(row,{day:$('row-day').value,period:Number($('row-period').value),room:$('row-room').value.trim(),courseId:$('row-course').value,subject:$('row-detail').value.trim(),note:$('row-note').value.trim(),uncertain:$('row-uncertain').checked,sourceText:old.sourceText||'Added in routine management'});
      else Object.assign(row,{code:$('row-code').value.trim(),title:$('row-detail').value.trim(),notes:$('row-note').value.trim(),showInDistribution:$('row-distribution-visible').checked});
      if(mode==='entries'&&['XI','XII'].includes(row.level))row.section=$('row-section').value.trim();
      if(mode==='entries'&&row.courseId&&!next.courses.some(c=>c.id===row.courseId)){
        const subject=yearCourses().find(c=>c.id===row.courseId);if(!subject)throw new Error('বিষয়টি পাওয়া যায়নি। বর্ষ ও বিষয় আবার বেছে নিন।');
        next.courses.push({...subject,teacherCodes:[],showInDistribution:false});
      }
      if(mode==='courses'){
        const subject=window.GeoRoutineSubjects?.list(row.level).find(c=>c.code===row.code);
        if(subject){row.title=subject.title;row.subjectType=subject.subjectType;}
        if(next.courses.some(c=>c.id!==editId&&c.level===row.level&&c.code&&c.code===row.code))throw new Error('এই বর্ষে একই Subject Code আগে থেকেই আছে। সেটি Edit করে শিক্ষক বেছে নিন।');
      }
      const index=next[mode].findIndex(r=>r.id===editId);if(index<0)next[mode].push(row);else next[mode][index]=row;
      store.validate(next);
      busy=true;state();
      const saved=await store.save(next,revision);
      data=store.clone(saved.document);revision=saved.revision;dirty=false;previewReady=false;previewSnapshot='';
      render();$('row-dialog').close();
      message('এন্ট্রিটি সরাসরি ডেটাবেসের খসড়ায় সংরক্ষিত হয়েছে। শিক্ষার্থীদের দেখাতে প্রিভিউ দেখে প্রকাশ করুন।');
    }catch(error){$('row-error').textContent=store.errorText(error);}
    finally{busy=false;state();}
  };
  $('row-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  function openTeacher(t){if(settingsPending)return message('আগে সেটিংস খসড়ায় প্রয়োগ করুন।',true);oldTeacherCode=t?.code||'';$('teacher-code').value=t?.code||'';$('teacher-name').value=t?.name||'';$('teacher-designation').value=t?.designation||'';$('teacher-error').textContent='';$('teacher-dialog').showModal();}
  $('teacher-form').onsubmit=e=>{
    e.preventDefault();try{
      const next=store.clone(data),code=$('teacher-code').value.trim().toUpperCase(),teacher={code,name:$('teacher-name').value.trim(),designation:$('teacher-designation').value.trim()};
      const index=next.teachers.findIndex(t=>t.code===oldTeacherCode);if(index<0)next.teachers.push(teacher);else{next.teachers[index]=teacher;[...next.entries,...next.courses].forEach(r=>r.teacherCodes=r.teacherCodes.map(c=>c===oldTeacherCode?code:c));}
      store.validate(next);data=next;changed();populate();$('teacher-dialog').close();
    }catch(error){$('teacher-error').textContent=store.errorText(error);}
  };
  $('settings-form').onsubmit=e=>{
    e.preventDefault();try{const next=store.clone(data);next.effectiveDate=$('effective').value;next.distributionDate=$('distribution').value;next.days=$('days').value.split(',').map(s=>s.trim()).filter(Boolean);next.levels=$('levels').value.split(',').map(s=>s.trim()).filter(Boolean);next.notes=$('routine-notes').value.split('\n').map(s=>s.trim()).filter(Boolean);next.break.start=$('break-start').value;next.break.end=$('break-end').value;
      next.periods.forEach((p,i)=>{p.start=$('period-'+i+'-start').value;p.end=$('period-'+i+'-end').value;p.label=p.start+'–'+p.end;});store.validate(next);data=next;settingsPending=false;changed();populate();message('Settings applied to draft. Save draft করুন।');
    }catch(error){message(store.errorText(error),true);}
  };
  $('settings-form').addEventListener('input',()=>{settingsPending=true;previewReady=false;state();});
  for(const kind of ['signature','seal']){
    $(kind+'-upload').addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file||busy)return;
      busy=true;state();
      try{
        const src=await window.GeoRoutineImages.readFile(file,kind),next=store.clone(data);
        next.printAssets={...next.printAssets,[kind]:src};store.validate(next);data=next;
        changed();renderBranding();message('ছবি যোগ হয়েছে। Save signature & seal চাপুন; তারপর Preview দেখে Publish করুন।');
      }catch(error){message(store.errorText(error),true);}
      finally{event.target.value='';busy=false;state();}
    });
    $('remove-'+kind).onclick=()=>{
      if(busy||!data?.printAssets?.[kind])return;
      delete data.printAssets[kind];changed();renderBranding();message('ছবি সরানো হয়েছে। পরিবর্তন সংরক্ষণ করে Publish করুন।');
    };
  }
  $('save-print-assets').onclick=()=>$('save-draft').onclick();
  $('save-draft').onclick=async()=>{if(busy||settingsPending||!dirty)return;busy=true;state();try{const saved=await store.save(data,revision);revision=saved.revision;data=store.clone(saved.document);dirty=false;previewSnapshot='';message('Draft saved. Preview দেখে Publish করুন।');}catch(error){message(store.errorText(error),true);}finally{busy=false;state();}};
  $('preview-draft').onclick=()=>{if(busy||settingsPending)return;try{previewReady=false;if(revision!==publishedRevision){data.effectiveDate=store.effectiveDateToday();$('effective').value=data.effectiveDate;}store.validate(data);previewSnapshot=JSON.stringify(data);$('draft-preview').src='../student/class-routine.html?preview=1';$('preview-dialog').showModal();state();}catch(error){message(store.errorText(error),true);}};
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==$('draft-preview').contentWindow||!previewSnapshot||!$('preview-dialog').open)return;
    if(event.data?.type==='geo-routine-preview-ready')event.source.postMessage({type:'geo-routine-preview',document:JSON.parse(previewSnapshot)},location.origin);
    if(event.data?.type==='geo-routine-preview-rendered'){previewReady=true;state();}
  });
  $('publish-draft').onclick=async()=>{
    if(busy||settingsPending||!previewReady||dirty||previewSnapshot!==JSON.stringify(data))return message('আগে খসড়া সংরক্ষণ করে প্রিভিউ দেখুন।',true);
    const conflicts=window.GeoRoutineChecks.analyze(data).groups;if(!confirm('এই saved routine সব শিক্ষার্থীকে দেখাবেন?'+(conflicts.length?' '+conflicts.length+'টি conflict / তথ্য যাচাইয়ের note আছে—বিভাগ থেকে নিশ্চিত হলে publish করুন।':'')))return;
    busy=true;state();try{const live=await store.publish(revision);publishedRevision=live.revision;data.effectiveDate=live.document.effectiveDate;$('effective').value=data.effectiveDate;previewSnapshot=JSON.stringify(data);message('রুটিন প্রকাশিত হয়েছে। কার্যকর তারিখ: '+data.effectiveDate+' (বাংলাদেশ সময়)। Student panel এখন নতুন routine লোড করবে।');}catch(error){message(store.errorText(error),true);}finally{busy=false;state();}
  };
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('reload-draft').onclick=load;$('new-class').onclick=()=>openRow('entries');$('new-course').onclick=()=>openRow('courses');$('new-teacher').onclick=()=>openTeacher();
  $('edit-level').onchange=render;$('edit-teacher').onchange=render;$('edit-day').onchange=render;$('edit-period').onchange=render;
  $('clear-editor-filters').onclick=()=>{['edit-level','edit-teacher','edit-day','edit-period','editor-search'].forEach(id=>$(id).value='');render();};
  $('editor-search').addEventListener('input',render);
  document.querySelectorAll('[data-editor-layout]').forEach(button=>button.onclick=()=>{
    layout=button.dataset.editorLayout;const board=layout!=='table';$('class-board').hidden=!board;$('class-table').hidden=board;
    document.querySelectorAll('[data-editor-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    render();
  });
  document.querySelectorAll('[data-routine-view]').forEach(button=>button.onclick=()=>showView(button.dataset.routineView));
  showView('classes');
  window.addEventListener('beforeunload',event=>{if(dirty||settingsPending||busy){event.preventDefault();event.returnValue='';}});
  state();load();
})();
