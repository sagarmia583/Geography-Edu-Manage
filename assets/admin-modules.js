(function(){
  'use strict';
  const modules=[
    {id:'students',icon:'👥',name:'Students',description:'Student records, profiles and promotion',links:[['student-management.html','Student Management'],['actual-student-management.html','Actual Students'],['student-profile-edit.html','Student Profile Edit'],['promotion-management.html','Promotion']]},
    {id:'classes',icon:'📅',name:'Class & Courses',description:'Class routine, teachers and subjects',links:[['class-routine.html','Class Routine'],['subject-management.html','Subject Management'],['non-major-management.html','Non-major Groups']]},
    {id:'exam',icon:'📝',name:'Exam',description:'Create exams, schedule, enter marks and view results',links:[['exam-create.html','Create / Edit Exam'],['exam-schedule.html','Exam Schedule'],['student-subject-entry.html','Student Subjects'],['attendance-sheet.html','Attendance Sheet'],['seat-plan.html','Seat Plan'],['admit-card-print.html','Admit Cards'],['exam-block-management.html','Exam Block / Unblock'],['marks-entry.html','Subject Marks Entry'],['individual-marks-entry.html','Individual Marks Entry'],['missing-marks-list.html','Missing Marks'],['attendance-marks-entry.html','Attendance Marks'],['blank-marksheet-print.html','Blank Marksheet'],['incourse-result.html','Incourse Average'],['result-management.html','Result Options'],['result-upload.html','Final Result Import'],['final-result.html','Final Results']]},
    {id:'fees',icon:'💰',name:'Fees',description:'Seminar and land use fees, receipts and reports',links:[['seminar-fee.html','Seminar & Land Use Fees']]},
    {id:'library',icon:'📚',name:'Library',description:'Books, issues, returns and library reports',links:[['library-management.html','Seminar Library']]},
    {id:'tools',icon:'📢',name:'Notices & Data',description:'Notices and data management',links:[['notice-management.html','Notice Management'],['data-editor.html','Data Editor']]}
  ];
  const nav=document.querySelector('.panel-menu');if(!nav)return;
  const current=location.pathname.split('/').pop()||'index.html';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  function link(href,label){const a=el('a',label);a.href=href;if(href===current){a.classList.add('active');a.setAttribute('aria-current','page');}return a;}
  const logout=nav.querySelector('[data-logout]');
  // Preserve any page-specific link that is not in the shared catalogue.
  const known=new Set(['index.html','../student/index.html',...modules.flatMap(m=>m.links.map(l=>l[0]))]);
  const extras=[...nav.querySelectorAll('a[href]')].filter(a=>!a.hasAttribute('data-logout')&&!known.has(a.getAttribute('href')));
  nav.replaceChildren();nav.classList.add('admin-module-nav');nav.setAttribute('aria-label','Admin modules');
  nav.append(link('index.html','🏠 Dashboard'));
  modules.forEach(module=>{
    const group=el('details',null,'admin-module');group.dataset.module=module.id;
    const summary=el('summary'),label=el('span',module.icon+'  '+module.name);summary.append(label,el('span','⌄','module-chevron'));
    const links=el('div',null,'admin-module-links');module.links.forEach(([href,name])=>links.append(link(href,name)));
    group.open=module.links.some(([href])=>href===current);if(group.open)group.classList.add('contains-current');
    group.append(summary,links);nav.append(group);
    group.addEventListener('toggle',()=>{if(group.open)nav.querySelectorAll('.admin-module').forEach(other=>{if(other!==group)other.open=false;});});
  });
  if(extras.length){const group=el('details',null,'admin-module');group.append(el('summary','Other options'));const links=el('div',null,'admin-module-links');extras.forEach(a=>links.append(a));group.append(links);nav.append(group);}
  nav.append(link('../student/index.html','🎓 Student Panel'));if(logout)nav.append(logout);
  document.body.classList.add('admin-modules-enabled');

  // One mobile menu for every admin page; original logout handlers are retained.
  const sidebar=document.querySelector('.panel-sidebar');sidebar.id='admin-module-sidebar';
  const toggle=el('button','☰ Modules','admin-module-toggle');toggle.type='button';toggle.setAttribute('aria-controls',sidebar.id);toggle.setAttribute('aria-expanded','false');
  const host=document.querySelector('.topbar .inner,.routine-nav .nav-inner');if(host)host.prepend(toggle);
  const close=el('button','Close menu ×','admin-module-close');close.type='button';sidebar.prepend(close);
  const backdrop=el('button',null,'admin-module-backdrop no-print');backdrop.type='button';backdrop.setAttribute('aria-label','Close modules');backdrop.hidden=true;document.body.append(backdrop);
  function setOpen(open){document.body.classList.toggle('admin-navigation-open',open);toggle.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;if(open)close.focus();else toggle.focus();}
  toggle.onclick=()=>setOpen(!document.body.classList.contains('admin-navigation-open'));close.onclick=()=>setOpen(false);backdrop.onclick=()=>setOpen(false);
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('admin-navigation-open'))return;
    if(event.key==='Escape'){event.preventDefault();setOpen(false);}
    if(event.key==='Tab'){
      const items=[...sidebar.querySelectorAll('button,a,summary')].filter(n=>!n.closest('.admin-module')||n.tagName==='SUMMARY'||n.closest('.admin-module').open);
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  const desktop=window.matchMedia?.('(min-width:901px)');desktop?.addEventListener?.('change',e=>{if(e.matches){document.body.classList.remove('admin-navigation-open');toggle.setAttribute('aria-expanded','false');backdrop.hidden=true;}});

  const grid=document.querySelector('.management-grid');
  if(current==='index.html'&&grid){
    grid.replaceChildren();grid.classList.add('admin-dashboard-modules');
    modules.forEach(module=>{const group=el('details',null,'admin-dashboard-module'),summary=el('summary');summary.append(el('strong',module.icon+' '+module.name),el('span',module.description),el('small','Open options ⌄'));group.append(summary);const links=el('div',null,'dashboard-module-links');module.links.forEach(([href,name])=>links.append(link(href,name)));group.append(links);grid.append(group);});
    document.querySelectorAll('a.dash-card[href="result-management.html"]').forEach(n=>n.remove());
    const maintenance=[...document.querySelectorAll('.preload-panel,.safe-sheet-panel')];if(maintenance.length){const group=el('details',null,'admin-maintenance no-print');group.append(el('summary','Advanced data tools'));maintenance[0].before(group);maintenance.forEach(n=>group.append(n));}
  }
})();
