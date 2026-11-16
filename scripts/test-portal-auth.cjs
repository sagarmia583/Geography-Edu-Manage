const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const full = fs.readFileSync('assets/geography-api.js','utf8');
const start = full.indexOf('(function(){', full.indexOf('Supabase REST API'));
assert(start > 0);
const adapter = full.slice(start).replace(/\}\)\(\);\s*$/, `window.testApi = {
  sbRequest, sbPatchByRowId, sbDeleteByRowId, sbUpsertBy, sbLogin, sbGeoApiGet, sbGeoApiPost
};})();`);
const jwt = (name, seconds) => 'header.' + Buffer.from(JSON.stringify({sub:name,exp:Math.floor(Date.now()/1000)+seconds})).toString('base64url') + '.signature';
const active = () => ({loggedIn:true,role:'admin',authToken:jwt('owner',3600),authRefreshToken:'refresh-one'});
const reply = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json'}});
function harness(initial, fetchImpl) {
  let session = initial;
  const calls = [];
  const window = {};
  const context = vm.createContext({window,URL,URLSearchParams,Headers,Response,AbortController,atob,
    setTimeout,clearTimeout,console:{log(){},warn(){}},localStorage:{},
    getAuthSession:()=>session,saveAuthSession:s=>{session=s;},
    geoApiGet:null,geoApiPost:null,processGeoWriteQueue:null,
    fetch:async(url,opts)=>{calls.push({url,opts});return fetchImpl(url,opts);}});
  vm.runInContext(adapter,context);
  return {api:window.testApi,window,calls,getSession:()=>session,setSession:s=>{session=s;}};
}
async function main(){
  let h = harness(active(),()=>reply([{row_id:1}]));
  await h.api.sbRequest('Students');
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].opts.headers.Authorization,'Bearer '+h.getSession().authToken);
  const fresh = jwt('owner-new',3600);
  h = harness({...active(),authToken:jwt('expired',-1)}, url => url.includes('/auth/')
    ? reply({access_token:fresh,refresh_token:'refresh-two',expires_in:3600}) : reply([]));
  await Promise.all([h.api.sbRequest('Students'),h.api.sbRequest('Marks'),h.api.sbRequest('Exams')]);
  assert.equal(h.calls.filter(c=>c.url.includes('/auth/')).length,1);
  assert.equal(h.getSession().authRefreshToken,'refresh-two');
  assert(h.calls.filter(c=>c.url.includes('/rest/')).every(c=>c.opts.headers.Authorization==='Bearer '+fresh));
  h = harness(active(),(url,opts)=>url.includes('/auth/')
    ? reply({access_token:fresh,refresh_token:'next',expires_in:3600})
    : opts.headers.Authorization==='Bearer '+fresh ? reply([{row_id:1}]) : reply({message:'JWT expired'},401));
  await h.api.sbRequest('Marks',{}, {method:'POST',body:{Marks:'12'}});
  assert.equal(h.calls.length,3,'401 -> refresh -> one retry of rejected POST');
  h = harness(active(),url=>url.includes('/auth/')
    ? reply({access_token:fresh,refresh_token:'next',expires_in:3600}) : reply({message:'Unauthorized'},401));
  await assert.rejects(h.api.sbRequest('Students',{}, {method:'POST',body:{}}), /session/);
  assert.equal(h.calls.length,3,'no infinite auth retry');
  h = harness(active(),()=>reply({code:'42501',message:'denied'},403));
  await assert.rejects(h.api.sbRequest('Books',{}, {method:'POST',body:{}}),/denied INSERT on books/);
  assert.equal(h.calls.length,1,'no retry or refresh on permission denial');
  h = harness({...active(),authToken:jwt('expired',-1),authRefreshToken:undefined},()=>reply([]));
  await assert.rejects(h.api.sbRequest('Students'),/older session/);
  assert.equal(h.calls.length,0,'no fallback to anonymous on an expired admin session');
  h = harness({...active(),authToken:jwt('expired',-1)},()=>reply({error:'revoked'},400));
  await assert.rejects(h.api.sbRequest('Students'),/session has ended/);
  assert.equal(h.calls.length,1);
  h = harness({},()=>reply([]));
  await h.api.sbRequest('Notices');
  assert(!h.calls[0].opts.headers.Authorization.includes('undefined'));
  h = harness(active(),()=>reply([]));
  for(const table of ['Students','Marks','AttendanceMarks','Books','ResultSummary','Exams']) {
    await assert.rejects(h.api.sbPatchByRowId(table,1,{Status:'Active'}),/Update was not applied/);
    await assert.rejects(h.api.sbDeleteByRowId(table,1),/Delete was not applied/);
  }
  const before = h.calls.length;
  await assert.rejects(h.api.sbDeleteByRowId('Students',''), /row id missing/);
  assert.equal(h.calls.length,before);
  h = harness({},()=>reply({access_token:fresh,refresh_token:'persistent',expires_in:3600,user:{}}));
  const login = await h.api.sbLogin({username:'admin@example.com',password:'fixture'});
  assert.equal(login.user.authRefreshToken,'persistent');
  assert(login.user.authExpiresAt > Date.now()/1000);
  h = harness({...active(),authToken:jwt('expired',-1)}, url => {
    if(url.includes('/auth/')) {h.setSession({}); return reply({access_token:fresh,refresh_token:'new'});}
    return reply([]);
  });
  await assert.rejects(h.api.sbRequest('Students'),/login changed/);
  assert(!h.getSession().loggedIn,'refresh cannot resurrect a logged-out session');
  h = harness({...active(),authToken:jwt('expired',-1)},url=>url.includes('/auth/')
    ? reply({access_token:fresh,refresh_token:'rotated',expires_in:3600}) : reply([]));
  await h.window.geoSupabaseFetch('https://ejxmzylupdqankdxcnex.supabase.co/rest/v1/seminar_fee',
    {headers:{apikey:'publishable'},method:'POST',body:'[]'});
  assert.equal(h.calls.at(-1).opts.headers.get('Authorization'),'Bearer '+fresh);
  await h.window.geoSupabaseFetch('https://example.com/asset',{headers:{}});
  assert.equal(h.calls.at(-1).opts.headers.Authorization,undefined,'never inject token into other origins');
  assert.equal((await h.api.sbGeoApiGet('restoreMarksFromBackup')).success,false);
  assert.equal((await h.api.sbGeoApiPost({action:'safeSheetSetup'})).success,false);
  console.log('PASS: session persistence/refresh/concurrency, 401 retry, 403 denial, old/revoked/logout sessions, fee fetch isolation, rejected writes and honest maintenance responses.');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
