// Offline request/loader checks; does not access Supabase or control a browser.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
 const dom=new JSDOM(read('student/class-routine.html'),{url:'http://localhost:3003/student/class-routine.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document;w.eval(read('assets/class-routine-data.js'));w.eval(read('assets/class-routine-checks.js'));const seed=w.GEO_CLASS_ROUTINE_DATA;delete w.GEO_CLASS_ROUTINE_DATA;
 w.GEO_SUPABASE_URL='https://fixture.invalid';w.GEO_SUPABASE_PUBLISHABLE_KEY='public-key';let calls=[],response={ok:true,body:[{revision:2,document:seed}]};
 const fetch=async(url,options)=>{calls.push({url,options});return {ok:response.ok,status:response.status||200,json:async()=>url.includes('/subjects?')?[]:response.body};};
 w.fetch=fetch;w.geoSupabaseFetch=fetch;w.geoAdminAccessToken=async()=>'refreshed-admin-token';
 w.eval(read('assets/class-routine-store.js'));w.eval(read('assets/class-routine-subjects.js'));w.eval(read('assets/class-routine-loader.js'));await tick();
 assert.equal(calls.length,2);assert.match(calls[0].url,/class_routine_published/);assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[0].options.cache,'no-store');
 assert.match(calls[1].url,/\/subjects\?/);assert.equal(calls[1].options.headers.Authorization,undefined);
 assert.equal(w.GEO_CLASS_ROUTINE_DATA.entries.length,95);assert.ok(d.querySelector('script[src*="class-routine.js?v="]'));
 assert.equal(new URL(d.querySelector('script[src*="class-routine.js?v="]').src).searchParams.get('v'),new URL(d.querySelector('script[src*="class-routine-loader.js"]').src).searchParams.get('v'));
 assert.equal(w.GEO_ROUTINE_ADMIN_PREVIEW,false);
 await w.GeoRoutineStore.draft();assert.equal(calls.at(-1).options.headers.Authorization,'Bearer refreshed-admin-token');
 response={ok:true,body:{revision:3,document:seed}};await w.GeoRoutineStore.save(seed,2);
 assert.match(calls.at(-1).url,/rpc\/save_class_routine_draft$/);assert.equal(JSON.parse(calls.at(-1).options.body).p_expected_revision,2);
 // Publication uses the database timestamp, including the Bangladesh midnight boundary.
 assert.equal(w.GeoRoutineStore.effectiveDateToday('2026-11-16T17:59:59Z'),'2026-11-16');
 assert.equal(w.GeoRoutineStore.effectiveDateToday('2026-11-16T18:00:00Z'),'2026-11-17');
 const published={revision:3,document:seed,published_at:'2026-11-16T18:00:00Z'};
 response={ok:true,body:published};const result=await w.GeoRoutineStore.publish(3);
 assert.equal(result.document.effectiveDate,'2026-11-17');
 assert.equal(result.document.distributionDate,seed.distributionDate);
 assert.equal(seed.effectiveDate,'2026-11-12','Normalizing publication must not mutate the source draft');
 response={ok:true,body:[published]};
 assert.equal((await w.GeoRoutineStore.published()).document.effectiveDate,'2026-11-17','Later reads retain the publication date');
 response={ok:false,status:409,body:{code:'40001'}};await assert.rejects(()=>w.GeoRoutineStore.publish(2),/খসড়া/);
 response={ok:false,status:404,body:{code:'PGRST205'}};await assert.rejects(()=>w.GeoRoutineStore.published(),/class-routine-management.sql/);
 delete w.GEO_CLASS_ROUTINE_DATA;w.eval(read('assets/class-routine-loader.js'));await tick();
 assert.equal(w.GEO_CLASS_ROUTINE_DATA,undefined);assert.equal(d.getElementById('result-summary').getAttribute('role'),'alert');assert.ok([...d.querySelectorAll('button,select')].every(c=>c.disabled));
 assert(!d.getElementById('result-summary').textContent.includes('sql'),'Public load failures must not expose setup diagnostics');
 dom.window.close();console.log('PASS: public loading, authenticated save request, revision errors, setup errors and no stale fallback.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
