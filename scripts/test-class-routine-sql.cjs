// Isolated PostgreSQL tests; never connects to the project's database.
const {PGlite}=require('../scratch/sql-check/node_modules/@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../database/class-routine-management.sql'),'utf8');
async function main(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid,email text);
 INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111','sagarmia583@gmail.com');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
 await db.exec(sql);await db.exec(sql);
 async function as(role,id=''){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE '+role);}
 async function denied(query,params=[],code='42501'){await assert.rejects(()=>db.query(query,params),e=>e.code===code);}
 await as('anon');
 let live=(await db.query('SELECT * FROM public.class_routine_published')).rows[0];
 assert.equal(live.document.entries.length,95);assert.equal(live.document.courses.length,31);
 await denied('SELECT * FROM public.class_routine_drafts');
 await denied('DELETE FROM public.class_routine_published');
 await denied('SELECT public.publish_class_routine(1)');
 await as('authenticated','22222222-2222-4222-8222-222222222222');
 assert.equal((await db.query('SELECT * FROM public.class_routine_drafts')).rows.length,0);
 await denied('SELECT public.publish_class_routine(1)');
 await denied('SELECT public.save_class_routine_draft($1,1)',[live.document]);
 await as('authenticated','11111111-1111-4111-8111-111111111111');
 assert.equal((await db.query('SELECT * FROM public.class_routine_drafts')).rows.length,1);
 await denied("UPDATE public.class_routine_drafts SET revision=9 WHERE id=1");
 await denied("SELECT public.save_class_routine_draft('{}',1)",[],'22023');
 live.document.entries[0].room='Test room';
 const saved=(await db.query('SELECT public.save_class_routine_draft($1,1) AS data',[live.document])).rows[0].data;
 assert.equal(saved.revision,2);
 assert.notEqual((await db.query('SELECT document FROM public.class_routine_published')).rows[0].document.entries[0].room,'Test room');
 await denied('SELECT public.save_class_routine_draft($1,1)',[live.document],'40001');
 await denied('SELECT public.publish_class_routine(1)',[],'40001');
 await denied('SELECT public.publish_class_routine(NULL)',[],'40001');
 await db.query('SELECT public.publish_class_routine(2)');
 await as('anon');assert.equal((await db.query('SELECT document FROM public.class_routine_published')).rows[0].document.entries[0].room,'Test room');
 await db.exec('RESET ROLE');await db.exec(sql);
 assert.equal(Number((await db.query('SELECT revision FROM public.class_routine_drafts')).rows[0].revision),2);
 assert.equal((await db.query('SELECT document FROM public.class_routine_published')).rows[0].document.entries[0].room,'Test room');
 await db.close();console.log('PASS: routine SQL seed, repeat run, RLS, admin writes, draft isolation, stale/null revisions, publish.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
