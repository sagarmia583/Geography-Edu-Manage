# Portal audit — 11 November 2026

## কী পরীক্ষা করা হয়েছে

Admin, student এবং pages ফোল্ডারের সঙ্গে home page মিলিয়ে **৫৬টি HTML page**, **৮৩টি script**, **৭০টি সরাসরি লেখা API action**, এবং **২৫টি database table-এর code contract** পরীক্ষা করা হয়েছে। JavaScript syntax, স্থানীয় file reference এবং action dispatch-এ missing entry পাওয়া যায়নি। এটি static code audit; প্রতিটি browser interaction বা live Supabase operation সফল হয়েছে—এমন দাবি নয়।

Student create/update/import → subjects/assignments → exam/schedule → marks/attendance → result/publish/promotion, fee এবং library—এগুলোর shared database adapter ও permission dependency পর্যালোচনা করা হয়েছে। Print/layout এই database audit-এ নতুন করে visual test করা হয়নি।

## এই পরিবর্তনে ঠিক করা হয়েছে

| সমস্যা | পরিবর্তন |
| --- | --- |
| Login শুধু access token রাখছিল; token শেষ হলে সব page-এ JWT error | Refresh token ও expiry সংরক্ষণ; request-এর আগে renewal; 401 হলে একবার renewal/retry |
| একাধিক request একই token refresh করতে পারে | একই tab-এ shared promise; সমর্থিত browser-এ tabs-এর মধ্যে Web Lock |
| Seminar Fee পেজ পুরোনো token ধরে রাখছিল | একই session renewal ব্যবহার করে search, upload, save ও report |
| কিছু table-এর PATCH শূন্য row ফেরালেও পুরোনো row পড়ে success দেখাত | সব table-এ returned updated row ছাড়া success নয় |
| Delete-এ শূন্য row হলেও success | Missing row/policy error দেখায় |
| Failed insert-এর পরে অন্য/পুরোনো matching row পেলেই success | শুধু network-related failure-এ পাঠানো field-গুলোর সঙ্গে saved row মিলিয়ে যাচাই |
| Legacy backup restore ও schema setup বাস্তবে কিছু না করেও success দেখাত | স্পষ্ট unsupported response; failed restore-এ marks display মুছে ফেলে না |

## একবার চালানোর SQL

ফাইল: `database/portal-permissions-repair.sql`

1. Geography project-এর Supabase SQL Editor খুলুন: https://supabase.com/dashboard/project/ejxmzylupdqankdxcnex/sql/new
2. SQL ফাইলের **সম্পূর্ণ content** paste করে postgres role-এ Run করুন। কোনো UUID placeholder বদলাতে হবে না।
3. Script `sagarmia583@gmail.com`-এর প্রকৃত Auth UUID বের করবে। Account না থাকলে transaction বন্ধ হবে; password বা Auth user তৈরি/পরিবর্তন করবে না।
4. ফলাফলের `WARNING` ও `REVIEW` row পড়ুন। `OK` permission repair বোঝায়; সব feature-এর end-to-end verification নয়।
5. Website-এ `Ctrl+F5`, তারপর একবার Sign out → Admin Login করুন। পুরোনো session-এ refresh token নেই; নতুন login থেকে renewal কাজ করবে।

SQL বিদ্যমান table-এর SELECT/INSERT/UPDATE/DELETE, serial/identity sequence access এবং RLS একসঙ্গে ঠিক করে। **নতুন admin policy শুধু উল্লিখিত Auth account-এর জন্য**। Existing restrictive policy-তে সেই admin-এর exception যোগ হয়; অন্য policy condition অক্ষত থাকে। `tour_*`, `storage.*` এবং `auth.users` data পরিবর্তন করে না।

`seminar_fee(admission_roll, fee_type)` unique key না থাকলে এবং duplicate না থাকলে তৈরি করে। Duplicate payment থাকলে report দেয়; কোনো fee/marks/student row delete করে না। Missing table/column বা code-এ পাঠানো হয় না এমন বাধ্যতামূলক column থাকলে report দেয়; অনুমান করে column type বা replacement table বানায় না।

## SQL দিয়েই যেগুলো সমাধান হবে না

এগুলো source inspection-এ পাওয়া সীমাবদ্ধতা; permission repair-এর বাইরে:

- **Student login এখনও browser-side legacy password comparison।** Students table anonymous SELECT policy দিয়ে উন্মুক্ত থাকলে personal information এবং Password column-ও পড়া যেতে পারে। Password blank হলে বর্তমান login logic password match ছাড়াই ঢুকতে দেয়। Proper student Auth এবং server-side own-record access প্রয়োজন। এই SQL public access বাড়ায় না; বিদ্যমান broad policy report করে। RLS আগে বন্ধ থাকলে চালু করার পর student/public page-এর read access বিদ্যমান policy-র ওপর নির্ভর করবে।
- **Registration-এর profile picture পাঠানো হলেও `sbRegisterStudent` সেটি সংরক্ষণ করে না।** Storage upload এবং URL persistence আলাদা implementation প্রয়োজন।
- **কিছু profile field খালি করলে পুরোনো value ফিরে আসে।** Adapter-এ `newValue || oldValue` fallback আছে; intentional clearing আর omitted value আলাদা করা প্রয়োজন।
- **Exam + schedule, library copy + log এবং result import/promotion একাধিক REST request।** মাঝপথে connection failure হলে আংশিক save হতে পারে। Atomic operation-এর জন্য transactional server-side RPC প্রয়োজন।
- **Receipt number browser-এ আগের number পড়ে তৈরি হয়।** একসঙ্গে দুই operator save করলে একই number তৈরি হতে পারে। Unique constraint থাকলে error হবে; database-generated atomic receipt allocator প্রয়োজন।
- **Backup restore ও Safe Sheet Setup আসল Supabase migration/restore নয়।** এখন সঠিক message দেখাবে; পুরোনো marks পুনরুদ্ধার হয়েছে এমন দাবি করবে না।
- **Missing schema, existing unique/check/foreign-key constraint, trigger error বা পুরোনো row_id sequence conflict** live schema দেখে আলাদা repair লাগতে পারে। শুধু RLS দিয়ে এগুলো দূর হয় না।

## যাচাইয়ের প্রমাণ ও সীমা

- `node scripts/audit-portal.cjs`: syntax/action/local-reference audit passed; summary `scratch/portal-code-audit.json`।
- `node scripts/test-portal-auth.cjs`: refresh persistence, concurrent requests, 401 retry, 403 denial, old/revoked/logout session, fee fetch এবং failed write/maintenance behaviour passed। Mock HTTP; live credentials ব্যবহার হয়নি।
- `node scripts/test-portal-sql.cjs`: PGlite-এর isolated PostgreSQL database-এ পুরো SQL দুবার চলেছে। ২৫টি table-এ admin CRUD, অন্য account ও anonymous write denial, existing anonymous read, restrictive policy exception, sequence permission, fee unique key, duplicate preservation, missing schema report এবং missing admin rollback পরীক্ষা passed।
- SQL test dependency: `npm install --prefix scratch/sql-check --no-package-lock --no-audit --no-fund @electric-sql/pglite`।
- **Live Supabase-এ SQL চালানো হয়নি।** বর্তমান সব policy/schema এবং বাস্তব save ফলাফল এখনও live verification প্রয়োজন।

সূত্র: [Supabase RLS—UPDATE-এর সঙ্গে SELECT policy প্রয়োজন](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth access/refresh sessions](https://supabase.com/docs/guides/auth/sessions)।
