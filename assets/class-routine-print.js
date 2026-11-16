(function(){
  'use strict';
  // Admin preview and student printing share this document-only renderer.
  // Draft labels and validation warnings belong to the admin screen, not paper.
  let provider=null,target='routine';
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const date=value=>String(value||'').split('-').reverse().join('/');
  // Explicit slot selections win; otherwise the shared teacher/year rotation applies.
  const englishText=value=>String(value||'').replace(/বাংলা/g,'Bangla').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d));
  const courseTitle=course=>englishText(window.GeoRoutineSubjects?.title(course)??course?.title);
  const courseName=(data,entry)=>window.GeoRoutineChecks.isNonMajor(data,entry)?window.GeoRoutineChecks.nonMajorName(data,entry):courseTitle(window.GeoRoutineSubjects?.courseFor(data,entry)??data.courses.find(c=>c.id===entry.courseId&&c.level===entry.level));
  const classSubject=(data,entry)=>courseName(data,entry)||englishText(entry.subject).trim();
  function time(value){const [h,m]=value.split(':');return (Number(h)>12?Number(h)-12:Number(h))+'.'+m;}
  function entryText(e,data){
    return window.GeoRoutineFormat.fullEntry(data,e);
  }
  function table(headings,cls){const t=node('table',undefined,cls),thead=node('thead'),tr=node('tr');headings.forEach(h=>tr.append(node('th',h)));thead.append(tr);t.append(thead,node('tbody'));return t;}
  function fullTable(data,entries){
    const heads=['Days'];data.periods.forEach((p,i)=>{heads.push(time(p.start)+'–'+time(p.end));if(i===data.break.afterPeriod)heads.push(time(data.break.start)+'–'+time(data.break.end));});
    const t=table(heads,'rp-week'),cols=node('colgroup');
    heads.forEach((_,i)=>{const c=node('col');if(i===0)c.className='rp-day-col';if(i===data.break.afterPeriod+2)c.className='rp-break-col';cols.append(c);});t.prepend(cols);
    data.days.forEach((day,dayIndex)=>{const row=node('tr');row.append(node('th',day));
      data.periods.forEach((p,i)=>{const td=node('td');entries.filter(e=>e.day===day&&e.period===p.id).sort(window.GeoRoutineFormat.compareLevels).forEach(e=>{const line=node('div',entryText(e,data),'rp-entry');line.dataset.entryId=e.id;if(/^(XI|XII)$/i.test(e.level.trim()))line.classList.add('rp-higher-secondary','rp-level-'+e.level.trim().toLowerCase());td.append(line);});row.append(td);
        if(i===data.break.afterPeriod&&dayIndex===0){const br=node('td',undefined,'rp-break');br.rowSpan=data.days.length;br.append(node('span','B R E A K'));row.append(br);}
      });t.tBodies[0].append(row);
    });return t;
  }
  function listTable(data,entries,classWise,teacherWise){
    const headings=teacherWise?['Day','Time','Class','Course / subject','Room / details']:['Day','Time',classWise?'Course name':'Class / subject','Teacher','Room / details'];
    const t=table(headings,'rp-list'+(classWise?' rp-class-wise':'')+(teacherWise?' rp-teacher-wise':''));
    const widths=teacherWise?[12,16,17,37,18]:[12,16,32,24,16],cols=node('colgroup');
    widths.forEach(width=>{const col=node('col');col.style.width=width+'%';cols.append(col);});t.prepend(cols);
    t.classList.toggle('rp-compact',entries.length>26);t.classList.toggle('rp-spacious',entries.length<=14);
    const sorted=[...entries].sort((a,b)=>window.GeoRoutineFormat.compareEntries(data,a,b));
    const cells=[];
    sorted.forEach((e,index)=>{const p=data.periods.find(p=>p.id===e.period),tr=node('tr');tr.dataset.entryId=e.id;
      const teachers=e.teacherCodes.map(code=>data.teachers.find(t=>t.code===code)?.name||code).join(' / ');
      const nonMajor=window.GeoRoutineChecks.isNonMajor(data,e);
      const values=teacherWise?[e.day,p.start+'–'+p.end,nonMajor?'':e.level,classSubject(data,e),nonMajor?'':[e.room?'Room '+e.room:'',courseName(data,e)?englishText(e.subject):''].filter(Boolean).join(' · ')||'—']:[e.day,p.start+'–'+p.end,classWise||nonMajor?classSubject(data,e):e.level,nonMajor?'':teachers||'—',nonMajor?'':[e.room?'Room '+e.room:'',!classWise||courseName(data,e)?englishText(e.subject):''].filter(Boolean).join(' · ')||'—'];
      const row=values.map((value,column)=>{const td=node('td',value);td.dataset.column=String(column);tr.append(td);return td;});cells.push(row);t.tBodies[0].append(tr);
      if(index===0||sorted[index-1].day!==e.day)tr.classList.add('rp-day-start');
    });
    // Merge repeated values within each day so day boundaries remain clear.
    for(let column=0;column<5;column++){
      let anchor=null,lastKey=null;
      cells.forEach((row,index)=>{const td=row[column],value=td.textContent;
        const key=sorted[index].day+'|'+value;
        if(anchor&&key===lastKey){anchor.rowSpan+=1;td.remove();}
        else{anchor=td;lastKey=key;}
      });
    }
    return t;
  }
  function coursesTable(data,courses){
    const groups=node('div',undefined,'rp-course-groups');
    const levels=[...new Set([...data.levels,...courses.map(c=>c.level)])];
    levels.forEach(level=>{const rows=courses.filter(c=>c.level===level);if(!rows.length)return;
      const section=node('section',undefined,'rp-course-group');section.append(node('h2',level==='Masters'?'MSC':level));
      const t=node('table',undefined,'rp-courses'),cols=node('colgroup'),body=node('tbody');t.setAttribute('aria-label',level+' course distribution');
      ['rp-course-number','rp-course-title','rp-course-code','rp-course-teacher'].forEach(cls=>cols.append(node('col',undefined,cls)));t.append(cols,body);
      rows.forEach((c,i)=>{const tr=node('tr');tr.dataset.courseId=c.id;const codes=c.teacherCodes.length>2?c.teacherCodes[0]+',\n'+c.teacherCodes.slice(1).join(','):c.teacherCodes.join('/');[(i+1)+'.',courseTitle(c),c.code||'',codes].forEach(v=>tr.append(node('td',v)));body.append(tr);});
      section.append(t);groups.append(section);
    });return groups;
  }
  function teachersTable(teachers){
    const t=table(['S. No','Name of the Teacher','Symbolic Name','Designation'],'rp-teachers');teachers.forEach((teacher,i)=>{const tr=node('tr');[String(i+1).padStart(2,'0'),teacher.name,teacher.code,teacher.designation||''].forEach(v=>tr.append(node('td',v)));t.tBodies[0].append(tr);});return t;
  }
  function fit(){
    const root=document.getElementById('routine-print-root');if(!root)return;
    const page=root.firstElementChild,content=page.firstElementChild;
    content.style.transform='none';content.style.width='100%';
    // Let each row grow only as much as its text needs. A long teacher list
    // must not force every other row to the same tall height.
    for(const table of root.querySelectorAll('.rp-list')){
      table.style.height='';for(const row of table.tBodies[0].rows)row.style.height='';
    }
    // The fixed A4 container is measured in physical CSS units, independently of viewport/mobile styles.
    const style=getComputedStyle(page),width=page.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=page.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
    if(root.classList.contains('rp-filtered')&&width>0&&height>0){
      // Choose the largest scale that fits, measuring at its matching width.
      // Alternating height/width ratios can oscillate and leave a narrow table.
      const usableWidth=width-1,usableHeight=height-2;
      const fits=scale=>{
        content.style.width=(usableWidth/scale)+'px';
        return content.scrollHeight*scale<=usableHeight;
      };
      let scale=1;
      if(!fits(1)){
        let low=.01,high=1;
        for(let pass=0;pass<16;pass++){
          const candidate=(low+high)/2;
          if(fits(candidate))low=candidate;else high=candidate;
        }
        scale=low;
      }
      fits(scale);
      content.style.transform='scale('+scale+')';root.dataset.scale=String(scale);return;
    }
    const naturalWidth=Math.max(content.scrollWidth,content.getBoundingClientRect().width),naturalHeight=Math.max(content.scrollHeight,content.getBoundingClientRect().height);
    const scale=naturalHeight&&naturalWidth?Math.min(1,width/naturalWidth,(height-2)/naturalHeight):1;
    content.style.transform='scale('+scale+')';root.dataset.scale=String(scale);
  }
  function prepare(section='routine'){
    if(!provider)return null;target=section;
    const state=provider(section);
    if(!state){const old=document.getElementById('routine-print-root');if(old)old.remove();cleanup();return null;}
    const {data,entries,filters}=state;
    const courses=state.courses.filter(course=>course.showInDistribution!==false);
    section=state.section||section;target=section;
    const full=section==='routine'&&!filters.level&&!filters.teacher&&!filters.day;
    const teacherWise=section==='routine'&&!filters.level&&data.teachers.some(t=>t.code===filters.teacher);
    let root=document.getElementById('routine-print-root');if(!root){root=node('div');root.id='routine-print-root';document.body.append(root);}
    root.className=full?'rp-landscape':'rp-portrait';root.setAttribute('aria-hidden','true');root.replaceChildren();
    root.dataset.downloadName=['Geography',section==='courses'?'Course-Distribution':'Class-Routine',full?'Full':filters.level||'',filters.teacher||'',filters.day||'',data.effectiveDate].filter(Boolean).join('-').replace(/[^A-Za-z0-9_.-]+/g,'-')+'.pdf';
    if(section==='courses')root.classList.add('rp-distribution');
    if(section==='routine'&&!full)root.classList.add('rp-filtered');
    const page=node('div',undefined,'rp-page'),content=node('div',undefined,'rp-content'),header=node('header',undefined,'rp-header');page.append(content);root.append(page);
    header.append(node('div',data.institution||'Kumudini Govt. College, Tangail','rp-institution'),node('div',data.department||'Department of Geography & Environment','rp-department'));
    header.append(node('h1',section==='courses'?'Course Distribution':'Class Routine – '+data.effectiveDate.slice(0,4)));
    const teacher=data.teachers.find(t=>t.code===filters.teacher);
    const labels=[filters.level,teacher?teacher.name:filters.teacher?'Teacher not specified':'',section==='routine'?filters.day:''].filter(Boolean);
    if(section!=='courses'||labels.length)header.append(node('div',full?'XI, XII, Degree (Pass), Honours and MSc Final Year':labels.join(' · ')||'All classes','rp-subtitle'));
    if(teacher&&teacher.designation)header.append(node('div',teacher.designation,'rp-designation'));
    header.append(node('div',(section==='courses'?'':'Effective: ')+date(section==='courses'?data.distributionDate:data.effectiveDate),'rp-effective'));
    if(section==='routine'&&!full){const meta=node('div',undefined,'rp-meta');meta.append(node('span',entries.length+' scheduled classes'),node('span','Break: '+data.break.start+'–'+data.break.end));header.append(meta);}
    content.append(header,section==='courses'?coursesTable(data,courses):full?fullTable(data,entries):listTable(data,entries,!!filters.level,teacherWise));
    const footer=node('footer',undefined,'rp-footer');if(full&&data.teachers.length)footer.append(teachersTable(data.teachers));
    const signature=node('div',undefined,'rp-signature'),images=node('div',undefined,'rp-signature-images');
    for(const kind of ['signature','seal']){
      const src=data.printAssets?.[kind];
      if(typeof src==='string'&&src.length<=512000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)){
        const img=node('img',undefined,'rp-'+kind+'-image');img.alt=kind==='signature'?'Signature':'Official seal';img.src=src;images.append(img);
      }
    }
    if(images.children.length){signature.classList.add('rp-signed');signature.append(images);}
    signature.append(node('div','Head of the Department'),node('div','Geography & Environment'),node('div',data.institution||'Kumudini Govt. College, Tangail'));footer.append(signature);if(section!=='courses')content.append(footer);
    let style=document.getElementById('routine-page-size');if(!style){style=node('style');style.id='routine-page-size';document.head.append(style);}
    style.textContent='@page { size: A4 '+(full?'landscape':'portrait')+'; margin: 0; }';
    document.body.classList.remove('print-target-routine','print-target-courses');document.body.classList.add('routine-print-ready','print-target-'+section);
    fit();return root;
  }
  function cleanup(){document.body.classList.remove('routine-print-ready','print-target-routine','print-target-courses');target='routine';}
  async function readyImages(root){
    await Promise.all([...root.querySelectorAll('img')].map(img=>new Promise((resolve,reject)=>{
      if(img.complete)return img.naturalWidth?resolve():reject(new Error('স্বাক্ষর বা সিলের ছবি পড়া যাচ্ছে না। Admin থেকে ছবিটি আবার upload করুন।'));
      const done=error=>{clearTimeout(timer);img.removeEventListener('load',loaded);img.removeEventListener('error',failed);error?reject(error):resolve();};
      const loaded=()=>done(),failed=()=>done(new Error('স্বাক্ষর বা সিলের ছবি পড়া যাচ্ছে না।'));
      const timer=setTimeout(()=>done(new Error('ছবিটি লোডের সময় শেষ হয়েছে। আবার চেষ্টা করুন।')),10000);
      img.addEventListener('load',loaded);img.addEventListener('error',failed);
    })));
  }
  window.addEventListener('beforeprint',()=>{if(document.body.classList.contains('routine-print-ready')&&document.getElementById('routine-print-root'))fit();else prepare(target);});window.addEventListener('afterprint',cleanup);
  window.GeoRoutinePrint={courseName,classSubject,courseTitle,englishText,readyImages,cleanup,configure(fn){provider=fn;},prepare,fit,print(section){
    const root=prepare(section);if(!root)return;
    if(!root.querySelector('img'))return window.print();
    return readyImages(root).then(()=>{fit();window.print();}).catch(error=>{cleanup();throw error;});
  }};
})();
