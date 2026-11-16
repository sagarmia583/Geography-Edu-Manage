const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'assets/geography-api.js'), 'utf8');
const headers = JSON.parse(api.match(/const GEO_SB_TABLE_HEADERS = (\{[\s\S]*?\n\});/)[1]);
const map = JSON.parse(api.match(/const GEO_SB_TABLE_NAME_MAP = (\{[\s\S]*?\n\});/)[1]);
const contract = Object.fromEntries(Object.entries(map).map(([key, name]) => [name, ['row_id', ...headers[key]]]));
contract.seminar_fee = ['id','admission_roll','fee_type','receipt_no','receipt_date','name','class_roll',
  'registration_number','year','session','student_mobile','guardian_mobile','merit','migration',
  'amount','amount_in_words','updated_at'];
const quote = value => "'" + value.replace(/'/g, "''") + "'";
const sql = 'INSERT INTO pg_temp.geo_portal_expected (table_name, columns_expected) VALUES\n' +
  Object.entries(contract).map(([table, cols]) => `  (${quote(table)}, ARRAY[${cols.map(quote).join(',')}])`).join(',\n') + ';';
const sqlFile = path.join(root, 'database/portal-permissions-repair.sql');
const original = fs.readFileSync(sqlFile, 'utf8');
const generated = original.replace(/-- SCHEMA_CONTRACT_START[\s\S]*?-- SCHEMA_CONTRACT_END/,
  '-- SCHEMA_CONTRACT_START\n' + sql + '\n-- SCHEMA_CONTRACT_END');
if (process.argv.includes('--update-contract')) fs.writeFileSync(sqlFile, generated);
else if (generated !== original) throw new Error('SQL contract is stale; run with --update-contract.');

const failures = [], missingAssets = [], actions = new Set();
const files = ['index.html', ...['admin','pages','student'].flatMap(dir =>
  fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => dir + '/' + f))];
let scripts = 0;
for (const filename of files) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=|application\/(?:ld\+)?json/i.test(match[1]) || !match[2].trim()) continue;
    try { new vm.Script(match[2], {filename}); scripts++; }
    catch (err) { failures.push({filename, error:err.message}); }
  }
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    const url = match[1].split(/[?#]/)[0];
    if (!url || /^(?:https?:|data:|javascript:|mailto:|tel:|\/\/)/i.test(url) || /[${}]/.test(url)) continue;
    const file = path.resolve(path.dirname(path.join(root, filename)), url);
    if (!fs.existsSync(file)) missingAssets.push({filename, url});
  }
  for (const match of html.matchAll(/(?:geoApiGet\(\s*|\baction\s*:\s*)['"]([\w]+)['"]/g)) actions.add(match[1]);
}
for (const file of ['assets/geography-api.js','assets/site.js','assets/supabase-config.js','server.js']) {
  try { new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), {filename:file}); scripts++; }
  catch (err) { failures.push({filename:file, error:err.message}); }
}
const implemented = new Set([...api.slice(api.indexOf('async function sbGeoApiGet')).matchAll(/case ['"]([^'"]+)['"]/g)].map(m => m[1]));
const unsupported = [...actions].filter(action => !implemented.has(action));
const result = {pages:files.length, scripts, tables:Object.keys(contract).length, actions:actions.size,
  syntaxErrors:failures, unsupportedLiteralActions:unsupported, missingLocalReferences:missingAssets};
fs.mkdirSync(path.join(root,'scratch'), {recursive:true});
fs.writeFileSync(path.join(root,'scratch/portal-code-audit.json'), JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if (failures.length || unsupported.length) process.exitCode = 1;
