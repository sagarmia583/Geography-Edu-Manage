(function(){
  'use strict';
  async function readFile(file,kind){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG, JPG অথবা WebP ছবি দিন।');
    if(file.size>4*1024*1024)throw new Error('ছবির আকার সর্বোচ্চ ৪ MB হতে পারবে।');
    const url=URL.createObjectURL(file),img=new Image();
    try{
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('ছবিটি লোড হয়নি। আবার চেষ্টা করুন।')),10000);
        img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(new Error('ছবিটি পড়া যাচ্ছে না। অন্য ছবি দিন।'));};img.src=url;
      });
      if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>8192||img.naturalHeight>8192)throw new Error('ছবির দৈর্ঘ্য ও প্রস্থ সর্বোচ্চ ৮১৯২ pixel হতে পারবে।');
      const scale=Math.min(1,(kind==='signature'?900:500)/img.naturalWidth,500/img.naturalHeight);
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const result=canvas.toDataURL('image/png');
      if(result.length>512000)throw new Error('ছবিটি বড় হচ্ছে। ছোট বা কম রঙের ছবি দিন।');
      return result;
    }finally{URL.revokeObjectURL(url);}
  }
  window.GeoRoutineImages={readFile};
})();
