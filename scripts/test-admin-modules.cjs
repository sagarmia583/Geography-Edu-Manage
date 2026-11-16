// Offline navigation regression checks; no network or live database access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('../scratch/routine-check/node_modules/jsdom');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
async function main(){
 let pages=0;
 for(const file of fs.readdirSync(path.join(root,'admin')).filter(f=>f.endsWith('.html'))){
  const html=read('admin/'+file);if(!html.includes('admin-modules.js'))continue;
  const dom=new JSDOM(html,{url:'http://localhost:3004/admin/'+file,runScripts:'outside-only'}),w=dom.window,d=w.document;
  let logouts=0;const original=d.querySelector('.panel-menu [data-logout]');if(original)original.onclick=()=>logouts++;
  w.eval(read('assets/admin-modules.js'));const nav=d.querySelector('.admin-module-nav');assert.ok(nav,file);
  assert.equal(nav.querySelectorAll('.admin-module').length,6,file);
  const active=nav.querySelector('[aria-current="page"]');assert.ok(active,file);assert.equal(active.getAttribute('href'),file);
  assert.equal(nav.querySelectorAll('.admin-module[open]').length,file==='index.html'?0:1,file);
  for(const a of nav.querySelectorAll('a[href]'))assert.ok(fs.existsSync(path.resolve(root,'admin',a.getAttribute('href'))),file+': '+a.href);
  const exam=nav.querySelector('[data-module="exam"]');assert.equal(exam.querySelectorAll('a').length,16);
  exam.open=true;exam.dispatchEvent(new w.Event('toggle'));assert.equal(nav.querySelectorAll('.admin-module[open]').length,1);
  const fees=nav.querySelector('[data-module="fees"]');fees.open=true;fees.dispatchEvent(new w.Event('toggle'));assert.equal(exam.open,false);
  d.querySelector('.admin-module-toggle').click();assert.equal(d.querySelector('.admin-module-toggle').getAttribute('aria-expanded'),'true');assert.equal(d.activeElement,d.querySelector('.admin-module-close'));
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.querySelector('.admin-module-toggle').getAttribute('aria-expanded'),'false');assert.ok(d.querySelector('.admin-module-backdrop').hidden);
  if(original){assert.equal(nav.querySelector('[data-logout]'),original);original.click();assert.equal(logouts,1);}
  if(file==='index.html'){assert.equal(d.querySelectorAll('.admin-dashboard-module').length,6);assert.equal(d.querySelectorAll('.admin-dashboard-module[open]').length,0);assert.ok(d.querySelector('.admin-maintenance'));}
  dom.window.close();pages++;
 }
 assert.equal(pages,28);console.log('PASS: '+pages+' admin pages, grouped routes, active module, accordion, mobile close/focus, dashboard and logout preservation.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
