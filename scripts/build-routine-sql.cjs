const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/class-routine-data.js'),'utf8'),ctx);
const json=JSON.stringify(ctx.window.GEO_CLASS_ROUTINE_DATA).replace(/'/g,"''");
const file=path.join(root,'database/class-routine-management.sql');
const seed=`INSERT INTO public.class_routine_drafts(id,document) VALUES(1,'${json}'::jsonb) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.class_routine_published(id,document,revision)
 SELECT id,document,revision FROM public.class_routine_drafts WHERE id=1 ON CONFLICT(id) DO NOTHING;`;
fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/-- INITIAL_ROUTINE_START[\s\S]*?-- INITIAL_ROUTINE_END/,'-- INITIAL_ROUTINE_START\n'+seed+'\n-- INITIAL_ROUTINE_END'));
console.log('SQL includes the confirmed routine. Existing database versions will be preserved.');
