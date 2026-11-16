(function(){
  'use strict';
  const base=new URL('../assets/',location.href),loading=new Map();let busy=false;
  function library(file,ready){
    if(ready())return Promise.resolve();
    if(loading.has(file))return loading.get(file);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL('vendor/'+file,base).href;
      const finish=error=>{clearTimeout(timer);if(error){script.remove();loading.delete(file);reject(error);}else resolve();};
      const timer=setTimeout(()=>finish(new Error('PDF তৈরির ফাইল লোড হয়নি। আবার চেষ্টা করুন।')),15000);
      script.onload=()=>finish(ready()?null:new Error('PDF তৈরির ফাইল সঠিক নয়। পেজ Reload করুন।'));
      script.onerror=()=>finish(new Error('PDF তৈরির ফাইল লোড হয়নি। পেজ Reload করুন।'));
      document.head.append(script);
    });loading.set(file,promise);return promise;
  }
  async function createPDF(section='routine'){
    if(busy)throw new Error('PDF তৈরি হচ্ছে। একটু অপেক্ষা করুন।');
    busy=true;const renderer=window.GeoRoutinePrint;
    try{
      const root=renderer.prepare(section);if(!root)throw new Error('আগে রুটিন বা course distribution লোড করুন।');
      await Promise.all([library('html2canvas-1.4.1.min.js',()=>!!window.html2canvas),library('jspdf-4.2.1.umd.min.js',()=>!!window.jspdf?.jsPDF),renderer.readyImages(root),document.fonts?.ready]);
      renderer.fit();
      const landscape=root.classList.contains('rp-landscape'),page=root.querySelector('.rp-page');
      const canvas=await window.html2canvas(page,{
        scale:2.5,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:0,windowWidth:1200,windowHeight:1200,
        onclone(doc){
          const copy=doc.getElementById('routine-print-root');
          for(const child of [...doc.body.children])if(child!==copy)child.remove();
          copy.style.setProperty('position','absolute','important');copy.style.setProperty('left','0','important');copy.style.setProperty('top','0','important');copy.style.setProperty('visibility','visible','important');
          doc.body.style.margin='0';doc.body.style.padding='0';
        }
      });
      const pdf=new window.jspdf.jsPDF({orientation:landscape?'landscape':'portrait',unit:'mm',format:'a4',compress:true});
      const width=pdf.internal.pageSize.getWidth();
      // The print page deliberately reserves 1 mm at the bottom to avoid spillover.
      pdf.addImage(canvas,'PNG',0,0,width,width*canvas.height/canvas.width,undefined,'FAST');
      pdf.setProperties({title:root.dataset.downloadName.replace(/\.pdf$/,''),creator:'Geography Department'});
      return {blob:pdf.output('blob'),filename:root.dataset.downloadName};
    }finally{busy=false;renderer.cleanup();}
  }
  async function download(section){
    const {blob,filename}=await createPDF(section),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  window.GeoRoutinePDF={createPDF,download};
})();
