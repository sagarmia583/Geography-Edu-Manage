(async function(){
  window.GEO_ROUTINE_ADMIN_PREVIEW=false;
  const summary=document.getElementById('result-summary');
  const controls=[...document.querySelectorAll('button,select')];controls.forEach(c=>c.disabled=true);
  summary.textContent='Loading published routine…';
  try{
    let record;
    if(new URLSearchParams(location.search).get('preview')==='1' && window.parent!==window){
      document.body.classList.add('routine-draft-preview');
      const filterPanel=document.querySelector('.filter-panel');
      const filterDetails=document.createElement('details');filterDetails.className='preview-filter-toggle no-print';
      const filterTitle=document.createElement('summary');filterTitle.textContent='Preview by academic level, teacher or day';
      filterPanel.before(filterDetails);filterDetails.append(filterTitle,filterPanel);
      summary.textContent='Loading draft preview…';
      record=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(new Error('খসড়ার প্রিভিউ লোডের সময় শেষ হয়েছে। প্রিভিউ বন্ধ করে আবার খুলুন।'));},15000);
        function receive(event){
          if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='geo-routine-preview')return;
          clearTimeout(timer);window.removeEventListener('message',receive);resolve({document:event.data.document});
        }
        window.addEventListener('message',receive);window.parent.postMessage({type:'geo-routine-preview-ready'},location.origin);
      });
      window.GEO_ROUTINE_ADMIN_PREVIEW=true;
      document.title='Draft class routine preview';
    }else record=await window.GeoRoutineStore.published();
    window.GEO_CLASS_ROUTINE_DATA=window.GeoRoutineStore.validate(record.document);
    await window.GeoRoutineSubjects?.load(window.GEO_CLASS_ROUTINE_DATA);
    controls.forEach(c=>c.disabled=false);
    // Both the public page and embedded admin preview load the same UI revision.
    const loader=document.querySelector('script[src*="class-routine-loader.js"]');
    const version=loader?new URL(loader.src,location.href).searchParams.get('v'):null;
    const script=document.createElement('script'),scriptUrl=new URL('../assets/class-routine.js',location.href);
    if(version)scriptUrl.searchParams.set('v',version);
    script.src=scriptUrl.href;
    script.onload=()=>{if(new URLSearchParams(location.search).get('preview')==='1'&&window.parent!==window)window.parent.postMessage({type:'geo-routine-preview-rendered'},location.origin);};
    script.onerror=()=>{summary.textContent='রুটিন দেখানো যাচ্ছে না। পেজটি আবার লোড করুন।';controls.forEach(c=>c.disabled=true);};
    document.body.append(script);
  }catch(error){
    summary.textContent=window.GEO_ROUTINE_ADMIN_PREVIEW ? error.message+' — আবার চেষ্টা করতে পেজটি লোড করুন।' : 'Routine এখন লোড করা যাচ্ছে না। কিছুক্ষণ পরে পেজটি Reload করুন।';
    summary.setAttribute('role','alert');
  }
})();
