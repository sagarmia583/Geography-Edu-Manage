// Isolated PostgreSQL fixture. Never connects to the live Supabase database.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../scratch/sql-check/node_modules/@electric-sql/pglite');
const sql = fs.readFileSync('database/portal-permissions-repair.sql','utf8');
const contract = sql.match(/INSERT INTO pg_temp.geo_portal_expected[\s\S]*?;/)[0];
const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const qi = s => '"' + s.replace(/"/g,'""') + '"';
async function main() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users VALUES ('${owner}','sagarmia583@gmail.com');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TEMP TABLE geo_portal_expected(table_name text PRIMARY KEY, columns_expected text[]);
    ${contract}`);
  const tables = (await db.query('SELECT * FROM geo_portal_expected')).rows;
  for (const t of tables) {
    const cols = t.columns_expected.map(c => qi(c) + (['id','row_id'].includes(c) ? ' bigserial PRIMARY KEY' : ' text'));
    await db.exec(`CREATE TABLE public.${qi(t.table_name)} (${cols.join(',')});`);
  }
  await db.exec(`INSERT INTO public.students ("Name") VALUES ('Existing student');
    ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.students TO anon;
    CREATE POLICY legacy_anon_read ON public.students FOR SELECT TO anon USING (true);
    CREATE POLICY old_restriction ON public.students AS RESTRICTIVE FOR ALL TO PUBLIC
      USING (current_user = 'anon') WITH CHECK (false);`);
  let result = await db.exec(sql);
  assert.equal(result.at(-1).rows.filter(r => r.severity === 'WARNING').length, 0);
  const policyBefore = (await db.query("SELECT qual,with_check FROM pg_policies WHERE policyname='old_restriction'")).rows;
  await db.exec(sql); // repeatable
  assert.deepEqual((await db.query("SELECT qual,with_check FROM pg_policies WHERE policyname='old_restriction'")).rows, policyBefore);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.students')).rows[0].n, 1);
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',false);`);
  for (const t of tables) {
    const name = qi(t.table_name), key = t.table_name === 'seminar_fee' ? 'id' : 'row_id';
    const inserted = await db.query(`INSERT INTO public.${name} DEFAULT VALUES RETURNING ${qi(key)}`);
    const id = inserted.rows[0][key];
    const col = t.columns_expected.find(c => !['id','row_id'].includes(c));
    const updated = await db.query(`UPDATE public.${name} SET ${qi(col)}='fixture' WHERE ${qi(key)}=$1 RETURNING *`,[id]);
    assert.equal(updated.rows.length, 1, t.table_name + ' UPDATE');
    assert.equal((await db.query(`DELETE FROM public.${name} WHERE ${qi(key)}=$1 RETURNING *`,[id])).rows.length,1);
  }
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${stranger}',false);`);
  for (const t of tables) {
    const name = qi(t.table_name);
    assert.equal((await db.query(`SELECT * FROM public.${name}`)).rows.length, 0);
    await assert.rejects(db.exec(`INSERT INTO public.${name} DEFAULT VALUES`), /row-level security/i);
  }
  assert.equal((await db.query('UPDATE public.students SET "Name"=\'unauthorized\' RETURNING *')).rows.length,0);
  assert.equal((await db.query('DELETE FROM public.students RETURNING *')).rows.length,0);
  await db.exec("RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',false);");
  assert.equal((await db.query('SELECT * FROM public.students')).rows.length,1);
  await assert.rejects(db.exec('INSERT INTO public.students DEFAULT VALUES'), /permission denied|row-level security/i);
  await db.exec('RESET ROLE');
  // Upsert key, missing-schema reporting and duplicate preservation.
  await db.exec(`INSERT INTO public.seminar_fee(admission_roll,fee_type) VALUES ('1','Seminar')
    ON CONFLICT(admission_roll,fee_type) DO UPDATE SET name='Test';
    DROP INDEX public.geo_portal_seminar_fee_identity_uq;
    INSERT INTO public.seminar_fee(admission_roll,fee_type) VALUES ('1','Seminar');
    ALTER TABLE public.students DROP COLUMN "PhotoURL";
    DROP TABLE public."Documents";`);
  result = await db.exec(sql);
  const warnings = result.at(-1).rows.filter(r => r.severity === 'WARNING');
  assert(warnings.some(r => r.object_name === 'Documents'));
  assert(warnings.some(r => r.detail.includes('PhotoURL')));
  assert(warnings.some(r => r.detail.includes('duplicate')));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM seminar_fee')).rows[0].n,2);
  // Missing Auth identity must fail instead of granting access to everybody.
  await db.exec('DELETE FROM auth.users');
  await assert.rejects(db.exec(sql), /Expected exactly one/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT "Name" FROM public.students')).rows[0].Name,'Existing student');
  await db.close();
  console.log('PASS: SQL executed twice; admin CRUD on 25 tables; other-user/anon denial; existing reads preserved; restrictive policy extension; sequence access; upsert index; missing-schema/duplicate reporting; missing-admin rollback.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
