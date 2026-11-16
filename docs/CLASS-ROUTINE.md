# Class routine and course distribution

The initial routine is transcribed from the supplied department image **effective 12 November 2026**. The course distribution is dated **11 November 2026**: 95 class entries and 31 course rows. Students now load the published document from Supabase. `assets/class-routine-data.js` is only the initial installation seed and transcription reference.

## Publishing and updating

1. Run the **entire** `database/class-routine-management.sql` in this project's Supabase SQL Editor as postgres. The Auth account `sagarmia583@gmail.com` must already exist; the script resolves its UUID automatically. It creates the routine tables, permissions, save/publish functions and initial routine. It does not change student, marks, exams or fee tables. Re-running preserves existing draft/published content.
2. Deploy the updated website files once, then sign in as that admin and open **Admin → Class Routine** (`admin/class-routine.html`).
3. Add, edit or remove classes, teachers and course distribution. Teacher-code changes update their class/course assignments. Dates, days and period times are under **Routine dates, days & period settings**; click **Apply settings to draft** after changing them.
4. Click **Save draft → Preview → close preview → Publish to students**. Preview must load successfully before publishing. Student pages load the latest published version on opening/reloading. Saved drafts remain private; future routine updates need neither code edits nor another SQL run.

The editor now shows one section at a time: **Classes**, **Course Distribution**, **Teachers** or **Settings**. Class filters include year, teacher and day; course filters include year and teacher. New classes start with the selected filters. Select teachers using checkboxes; multiple teachers are supported. A short message below the numbered Save/Preview/Publish buttons explains the next step. Advanced timing settings and overlap details stay collapsed until needed. Students can choose **আজকের class** to filter to today's day in Bangladesh time, while keeping their year/teacher selection.

## Printing

- With all filters cleared, **Print routine** produces one A4 landscape page in the supplied source's arrangement: centered college/department/title, effective-date box, day-by-period grid with a shared break column, teacher directory and department signature below.
- Selecting a class, teacher or day produces one A4 portrait page with a readable day/time/class/teacher/room list and the applicable teacher directory. **Print courses** also uses one A4 portrait page.
- Consecutive identical cells in filtered routine prints use rowspans. One selected class or teacher can span the entire list; times, room/details and blank groups stop at day boundaries. Entries keep their chronological order. Tests expand the merged table into its original five-column grid to verify no values shift or disappear.
- Course distribution follows the supplied image: an underlined title, date box, separate year headings and four-column tables (serial, course title, code, teacher code), with numbering restarted for each year. Blank source codes stay blank, Masters is labelled MSC, and the research-project teachers wrap as complete codes. It has no extra college header, teacher directory or signature footer.
- The print document is built from the current published/draft data, not from the original image or stale `sourceText`. The corrected SR assignment and later edits are reflected in print. Conflicts and incomplete details appear in red with reference codes and a compact note section; fitting includes these notes.
- `assets/class-routine-print.js` builds a dedicated print document and measures/scales its content to fit a fixed A4 container before printing, including Ctrl+P. `assets/class-routine-print.css` uses zero CSS page margins, with small internal clearance. Keep A4, default/100% print scale, and browser headers/footers off; manually overriding paper/scale in the print dialog can override website settings. Extremely large future datasets will use smaller text to retain one page.
- Six isolated Chromium PDF cases (full, Honours 4th Year, SR, unassigned teacher, all courses and long-content stress) were rendered and checked: one A4 page each, correct orientation, text bounds inside the sheet and signature present. Full, class and teacher output were visually inspected. These fixtures use the initial routine and make no live database writes.

Admin navigation is grouped into six expandable modules (Students, Class & Courses, Exam, Fees, Library, Notices & Data) on all 28 admin screens. **Class & Courses → Class Routine** opens this editor. Exam contains the schedule, student subjects, seating, attendance, marks and result pages. Click/tap a module to open it; the current page's module opens automatically. Mobile users use the **Modules** button. The shared navigation is maintained in `assets/admin-modules.js` and styled in `assets/admin-modules.css`; the dashboard uses the same catalogue.

Only this admin's Auth UUID can read drafts or call the save/publish functions. Both anonymous visitors and signed-in students can read published routine data. Direct table writes by application roles are denied. Concurrent updates check the expected revision and reject stale saves/publishes; reload and reconcile changes when warned. Save errors preserve the local editor contents. Teacher/time overlaps are displayed for review because the source itself contains overlaps.

There is no static-data fallback: a database/setup/network failure displays an error instead of showing an outdated routine. The original source images remain available as references, not as the current published version. `scripts/build-routine-sql.cjs` regenerates the initial seed section for maintenance; it is not part of normal admin updates.

A class naming only a year and teacher does **not** identify one specific course. Course distribution is displayed separately; multiple courses taught by the same teacher are not automatically attached to a time slot.

## Confirmed correction

On **15 November 2026**, the user confirmed that `SH` should be removed and that `SR = Md. Sohel Rana`. Tuesday 14:00 Honours 2nd Year practical in room 408 is therefore assigned to **SR**. The original source text is preserved for reference; this teacher identity is no longer marked uncertain. There are four teachers and 14 incomplete/uncertain class entries.

## Source details needing confirmation

| Source item | How it is retained |
| --- | --- |
| Sunday 10:30: `H₁-SR (408)` followed by a separate `ICT` line | ICT is associated tentatively with that entry and marked for confirmation. |
| Tuesday 13:15: `H₁-Prac.-ALL (408)` | ALL is retained; no individual teachers are inferred. |
| Wednesday 14:00: `M.sc-Prac.-` | Teacher and room remain blank. |
| Thursday 14:00: `H₃-Prac.- (407)` | Teacher remains blank. |
| Honours 1st Year: `213201 — Information and Communication Technology — ZR` | Source title/code retained, with a verification note because ICT appears again without a code. |
| Honours 1st Year ICT / SR, and Honours 2nd Year ICT | Codes remain blank; the second-year ICT teacher also remains blank. |
| Masters `313209 — Climate Change Mitigation & Migration` | “Migration” is retained exactly as supplied. |

Rooms are also missing for Monday 10:30 H1 Botany; Monday 14:00 XI Business and XII All; Tuesday 09:00 H1 ICT and 14:00 XI Business; Wednesday 11:15 H2 Botany and 14:00 XI Humanities A; Thursday 12:30 H1 Botany, 14:00 XI Humanities C and Masters practical/ZR. These are marked as incomplete.

`NM` denotes Non-major. Eco/SW/PS are expanded to Economics/Social Work/Political Science for display. NM entries do not name a teacher, so no teacher is assigned to them.

## Same-teacher overlaps after the confirmed correction

These six overlaps are retained; the department must confirm whether any are combined classes or source errors. The Tuesday overlap follows the confirmed SR correction.

| Day and time | Teacher | Entries |
| --- | --- | --- |
| Sunday 14:00–15:00 | SR | XI Humanities B; Degree 3rd Year practical |
| Monday 09:00–09:45 | SR | Degree 1st Year; Honours 3rd Year |
| Monday 12:30–13:15 | RS | Honours 1st Year; Honours 3rd Year |
| Monday 14:00–15:00 | SR | XI Business Studies; XII All groups |
| Tuesday 14:00–15:00 | SR | XI Business Studies; Honours 2nd Year practical |
| Wednesday 09:45–10:30 | SR | XI Science A + Humanities A + Business Studies; Honours 3rd Year |

The integrity test checks the transcription structure and source landmarks. It does not establish that the department's original schedule is conflict-free.

## Feature checks

- `node scripts/test-class-routine-ui.cjs` checks explicit Load behavior, routine/course selection, teacher/year/day filters, student diagnostic isolation, trusted preview warnings, today/now boundaries in Asia/Dhaka, empty states, CSV safety and full-only printed teacher legends. It uses offline jsdom; it does not control a browser or contact Supabase.
- Test-only dependency, if missing: `npm install --prefix scratch/routine-check --no-package-lock --no-audit --no-fund jsdom`.
- `node scripts/test-class-routine-admin.cjs` checks edit/save/preview/publish, teacher rename, pending settings and failed-save recovery using offline DOM and fake storage.
- `node scripts/test-admin-modules.cjs` checks all 28 admin screens, route targets, active/expanded groups, mobile menu focus/closing and preserved logout handlers.
- `node scripts/test-class-routine-loader.cjs` checks public/admin request separation, fresh loading, setup errors and refusal to use stale static data.
- `node scripts/test-class-routine-print.cjs` checks print selection/orientation, all row counts, break rowspan, teacher correction and cleanup, and writes offline PDF-rendering fixtures under `scratch/routine-print`.
- The merged-layout update was PDF-tested for Honours 1st Year, Sunday, SR, all courses and SR courses: each is one A4 portrait page, with the final row/footer present and text within the sheet. Course distribution and merged class/teacher pages were visually inspected.

## Routine conflict checks

`assets/class-routine-checks.js` supplies checks for admin rows and trusted admin draft previews, including draft prints. Published student tables, mobile cards, CSV and prints omit diagnostic notes and red conflict styling. It checks the whole routine before applying filters: simultaneous teacher bookings (T), simultaneous room bookings (R), identical duplicate entries (D), and missing teacher/room or marked uncertain details (N). Rooms normalize the optional `Room` prefix, whitespace and Bangla digits; teacher codes compare without case/whitespace differences. Different days and touching but non-overlapping time slots do not conflict. Repeated use of a teacher or room at different times is normal. A conflict note is a request to verify a booking, including possible combined classes; no entry is deleted automatically.

Red notes identify the resource, day/time and affected classes, including peers hidden by filters. Saving corrections recomputes the warnings. Print notes retain the same reference codes and auto-fit within the existing single-page layout. Full and SR PDFs with these notes were checked for one-page size, red text and content inside the A4 bounds. `node scripts/test-class-routine-checks.cjs` covers normalization, true overlaps, adjacent slots, separate days, duplicates, corrections and missing information.
- `node scripts/test-class-routine-sql.cjs` runs the migration in isolated PGlite PostgreSQL and checks RLS, denied unauthorized mutations, draft isolation, stale/null revisions, publication and repeat-run preservation. It does not contact the real project. Test dependency: `@electric-sql/pglite` under `scratch/sql-check`.
- Earlier browser attempts were unavailable, but the latest usability pass reached `localhost:3002` through the in-app browser. The student page loaded 95 class entries and 31 course allocations from the published endpoint. Honours 4th Year + today's Sunday filter showed two classes and eight courses, with no captured console warnings/errors. The mobile student layout was inspected. The isolated browser had no admin login, so the live admin screen and database mutations were not visually tested; admin interactions were covered by offline DOM tests. No live database writes were made by the agent.

## Student flow update — 15 November 2026

### Explicit class courses and print layout

Admin → Classes → Edit now includes **Course for this class**, limited to that class's academic level. Its optional `courseId` is stored in the existing draft/published JSON document; no SQL change is needed. Leaving it unselected leaves the course name blank. The app never guesses a slot's course from its teacher. Existing ICT, practical and non-major descriptions remain in the separate class-details column. Changing level clears the selection; ordinary edits retain it. Referenced courses cannot be removed until their class assignments are changed or cleared. Course title edits resolve through the stable ID.

Class-wise routine prints replace the Class column with Course name. Filtered routine prints use full teacher names. Student class-wise cards/timetables and CSV also include the explicitly assigned course. Course distribution titles are left-aligned on screen/print and its print header includes college and department. Portrait routine base rows are measured and equalized before A4 fitting; merged time/day cells retain their rowspans. PDFs for first year, fourth year, SR and all courses were checked as one A4 portrait page with text within bounds. First-year horizontal grid lines confirmed 20 equal base rows (30.82 pt), including the two Thursday entries sharing one time cell.

The student landing page shows today's classes and currently ongoing classes in Bangladesh time. A future effective date does not display classes as ongoing. Students select Class Routine or Course Distribution, set filters, then click Load. Changing a selection clears the previous result and disables its export/print buttons until loaded again. Query parameters preselect controls but do not auto-load results. Today's class is an explicit shortcut to load the current day. Course distribution ignores the day filter.

Teacher directory and transcription/source notes are removed from the student screen. Diagnostic text is also omitted from student CSV and print. The admin HTML now loads class-routine-checks.js before its controller; the admin test loads these dependencies in actual HTML order to catch missing-script regressions. Draft-preview diagnostics are enabled only after the loader receives the expected same-origin parent preview message. This is a display distinction; database publication/authentication rules are unchanged.

All routine/course table cells are centered on screen and print. Only the full unfiltered routine print includes the teacher-name/symbolic-name table. Filtered routine prints and course distribution omit it. The full routine is A4 landscape; filtered routines and courses are A4 portrait. Four updated offline PDF fixtures (full, first year, SR, all courses) were verified as single A4 pages with all text within bounds; full/SR layouts were visually reviewed.

Live localhost:3003 student verification loaded the published routine, showed Today/Now on entry, then loaded 20 first-year classes and four first-year course allocations on demand. No conflict notes or console errors/warnings were seen. Admin edit/save/preview/publish behavior was tested with offline fake storage; no live database writes were made. No additional SQL migration is required for this update.

### Routine language

Built-in admin validation, loading/access errors and teacher/room conflict messages use Bangla. Known source-review notes are translated for admin review. Public routine labels, filters, today/now messages and empty states use English; diagnostics remain admin-only. The supplied subject text বাংলা is displayed/exported as Bangla without modifying the stored document. Student screen, CSV and print fixtures are checked for Bengali characters; custom source data is preserved, not silently removed. No SQL changes are needed.

### Simplified student and admin views

Students choose between two large view buttons, select an academic level, then Load. Optional teacher/day filters are collapsed until needed, with active selections shown in their summary. Filtered routines use readable day cards on desktop and mobile; full routine, Today, Back to Today, CSV and print remain available. Loading stays explicit and the print renderer is unchanged.

Admin defaults to a day board. Each class card opens the existing draft editor with a day/time/level context; each day has an Add shortcut. Table view remains available. Search matches course titles, room, level, teacher code/name and details alongside existing filters. The Save/Preview/Publish toolbar remains visible while scrolling. No new tables or SQL changes are required.

Verified student loading on localhost:3003 and a 390px mobile viewport (no horizontal page overflow). Admin layout was reviewed using a static offline sample; card editing, day shortcuts, search and table switching were tested in jsdom with fake draft storage. Existing draft save/publish isolation tests pass. No production data was changed during verification.

### Day/time editing and direct entry save

Admin now has Day view, Time view and Table view, plus separate day/time filters. Add inside a day or time group preselects that slot. Editing an existing class can move it to another day/time while retaining its ID. Course distribution ignores day/time filters.

Saving a class or course in its dialog immediately calls the existing revision-checked draft save. A separate Save draft is no longer needed for these entries. Other pending local draft changes are saved with that document; teacher/settings edits and removals still use Save draft. Save failure retains the modal and entered values, and does not replace local data. While saving, controls are disabled, repeated submissions are ignored, and Escape cannot close the modal. Publish still requires a fresh preview after a successful save.

The class editor shows all courses from the selected level's Course Distribution as visible choices with teacher names. Courses assigned to the selected teacher appear first, but no course or teacher is assigned automatically. Selecting a choice sets the explicit course ID; the saved title then appears in routine cards and existing student/print renderers. Changing the academic level clears the choice. There is no new SQL migration.

Offline tests cover course choices and assignment, period 0 filtering, time-group Add, single-entry persistence after reload, moving an entry, double-submit protection, failed/stale-save recovery, and unchanged publication. Admin, student UI, loader and conflict-check suites pass. Course picker layout was visually inspected in the browser using a static offline sample; no live database writes were performed.

### Scheduled Class Report

Admin → Class Routine → Class Report shows the current working draft's scheduled class counts for one routine week. Academic level, teacher, day, period and search filters apply to the report. The source label identifies the draft revision and whether unsaved changes are included. It does not report completed classes or attendance.

Summary cards show total class entries, academic levels, involved teachers and classes with no teacher. Tables break down counts by day, teacher and academic level. A shared class counts once in the overall total and once per assigned teacher in the teacher table; teacher totals may therefore exceed the overall total. Course allocations are not counted as classes. The report is read-only and needs no database migration. Offline regression tests cover baseline counts, combined filters, empty results, shared teaching and no writes while viewing/filtering.

### Date-wise daily report and A4 portrait

Class Report now opens with a date, academic-level filter and teacher filter. Load report uses that date's weekday in the current draft routine and fetches active Students through the existing paginated `getStudents` API without a cache. Dates before the current routine's effective date are rejected; this is not a historical routine or roster archive. The earlier weekly counts remain in a collapsed section.

Totals are grouped by current academic year and `StudySessionYear`, falling back to `CurrentStudySession` and then `SessionYear`. Roll/registration identifies distinct students. Degree, Honours and XI/XII cohorts stay separate. A sole known session is selected automatically; multiple sessions require explicit selection for each level. Missing/inaccessible students or missing sessions never silently become a zero-student printable report. Date/filter/routine changes invalidate old rows and in-flight responses.

The Bengali daily form follows the supplied image: teacher, class, total students, present, absent, signature, institution/department heading, report date and head-of-department signature area. Each scheduled class and assigned teacher has a row; repeated teacher names merge vertically. Session and time distinguish repeated classes. Present counts are entered manually; absent is total minus present. Blank attendance remains blank; zero is valid. These attendance inputs are temporary page state, not a saved attendance register. Changing session clears attendance for that level. Print or Save as PDF preserves the completed document. No SQL change is needed.

Printing uses a dedicated A4 portrait page with content fitting and retains full table width when scaling. Offline PDFs with 20 and 50 rows were visually inspected and verified as one A4 portrait page with all rows retained. `node scripts/test-class-report.cjs` covers dates, session selection, student deduplication, >1000 returned rows, attendance validation, missing/failed data and stale responses; admin/student/loader regression suites also pass. Verification used sample records and did not write to the live database.

Degree, XI and XII are external cohorts whose student records are not maintained by this department. Their classes remain in daily reports, but do not require a session or student count to print. Total/present/absent cells stay blank, and the class cell does not show a missing-session placeholder. External-only reports skip the Students query entirely. Honours/Masters retain database counts and explicit selection when multiple sessions exist. Regression tests cover mixed reports, external-only reports with the student endpoint unavailable, blank printed cells and unchanged department-session requirements.

### Non-major display and Honours major diagnostics

Non-major routine entries display only the subject name, without the Non-major/NM prefix, room, teacher or diagnostic note. This applies to student timetable/cards/Today, full and filtered routine prints, CSV and the subject details on admin cards/tables. Admin editing still retains level/time context and the original stored data. Bangla remains the English display spelling of the subject বাংলা.

Routine conflict, duplicate and missing-information checks now use only Honours major entries. Non-major, Degree, XI, XII and Masters entries neither receive nor contribute these warnings. Explicit non-major subject types and Non-major/NM prefixes are recognized; explicit non-major course types and known ICT/English ancillary entries are excluded from checks. General data validation and save/authentication errors remain intact. Public pages still do not run diagnostic analysis. Regression tests cover excluded entries overlapping a major class, genuine major-to-major conflicts, admin display and full/filtered print cells. No SQL or stored-routine change is required.

### Class-wise and teacher-wise portrait layout

Filtered routine prints now use explicit column widths, a clear institution/department/title hierarchy, effective date, class count and break-time line. Class-wise sheets reserve space for course and full teacher names. A selected teacher's sheet shows the full name and designation in its header, then Day, Time, Class, Course/subject and Room/details columns; the repeated teacher column is removed. A class-plus-teacher filter uses the class-wise layout. Course assignment is still explicit; no missing major course is guessed.

Identical consecutive values merge only within a day, with clear day separators. Base rows have equal measured heights, spacious padding for short schedules and compact padding for larger schedules. The A4 fitter reflows at a wider logical width before scaling so the printed table keeps the full paper width. Signature space remains below the table. Full landscape routine and course distribution retain their existing layouts.

First-year, fourth-year, SR teacher and long-content PDFs were checked as single A4 portrait pages with the footer retained; normal class/teacher pages were visually reviewed. Table tests reconstruct merged cells to verify every original row/column remains in the right place, including non-major subject-only rows. Student UI, loader and diagnostic suites pass. No database changes or SQL are required.

### Shared admin and student printing

Admin preview embeds the same student routine page and uses the same `class-routine-print.js` and `class-routine-print.css`. Print rendering depends only on the routine document, selected view and filters. Draft labels and validation warnings remain on the admin screen; they do not alter print rows, headers, colors, notes or page fitting. Draft and published documents can contain different data until Publish, but their print layout is identical.

Future routine print changes must be implemented in these shared assets and verified through both panel paths. UI tests compare the full print DOM and paper configuration from both panels for full, class, teacher, day, combined and course-distribution selections. The print fixture suite also checks mode parity, including long-content fitting input. The loader inherits its UI revision from the shared page's loader URL so embedded and standalone pages use the same asset version. No SQL is required.

### Live student landing and distribution selection (16 November 2026)

The student landing now shows scheduled ongoing and next classes above the filters. Ongoing periods include start/end time, remaining minutes, total duration and elapsed progress. Next classes include the nearest future scheduled period, date/day, start countdown and duration; the search crosses weekends and respects the routine effective date. Bangladesh time is used throughout, with 15-second refresh, foreground refresh and back/forward-cache recovery. This describes the published schedule, not actual attendance. Entrance/status animation respects reduced-motion settings.

Both full routine and course distribution load below the live dashboard on entry. Filters can load a specific view. Printing either section still uses the shared admin/student renderer; landing dashboard elements never enter the print document.

Syllabus entry/upload is deferred at the user's request. Admin can enter courses manually and use the course editor's `Show in Course Distribution` checkbox. Optional boolean `showInDistribution` defaults to visible for existing data; false hides the course from distribution display, CSV and print in both panel paths. The course remains selectable for timetable slots and an assigned class still displays it. Save to draft, preview and publish retain their existing workflow. This field is stored in the existing routine JSON document; no schema migration or SQL is required. Visibility is a display selection, not an access-control boundary.

### Seconds countdown and Subjects names

The live dashboard now uses contrasting Now/Next cards, large HH:MM:SS countdowns, subject/teacher/room cards and a seconds-based progress bar. Bangladesh clock and countdowns update every second from absolute timestamps, including tab resume and period boundaries. Within the same minute only text/progress changes; cards are retained to avoid per-second scroll resets. Timer regions do not announce every second to screen readers, and animation respects reduced motion.

`class-routine-subjects.js` loads only SubjectCode, SubjectName and AcademicYear for routine course codes from the public Subjects endpoint. It batches and paginates requests, times out after five seconds and keeps stored names if unavailable. Names resolve by code and normalized academic year; conflicting names or wrong-year records retain the stored name. The same resolver supplies admin course choices, student screen/CSV and both print paths. No course or timetable data is automatically changed or saved. Slots still require explicit courseId selection; a course catalogue cannot determine which course runs at a given time. No RLS changes or SQL are needed when public Subjects reads are already allowed.

Tests cover seconds ticks without card replacement, period boundaries, subject ambiguity/wrong-year/read failures, immutable documents and shared print resolution. Browser verification confirmed the ticking dashboard and canonical names from the connected Supabase Subjects table.

### Year-wise Subjects catalogue and weekly course rotation

The user subsequently authorized automatic rotation, superseding the earlier explicit-selection-only rule. The public Subjects read now retrieves the complete paginated catalogue (SubjectID, SubjectCode, SubjectName, AcademicYear, SubjectType, Status). Admin course and class editors offer active subjects for the selected year, including courses not previously present in routine distribution. Choosing a catalogue subject for a class saves a hidden course reference without assigning teaching responsibility or adding it to distribution. The course editor assigns teachers and controls distribution visibility; duplicate codes within a year are rejected.

An empty Course selection means Auto. Blank-subject Honours/Masters slots with one teacher rotate through that teacher's assigned courses for that year, sorted by SubjectCode. Slots are ordered by routine weekday, period start and entry ID; the sequence restarts each week. Explicit course selections remain fixed and do not consume automatic rotation positions. Non-major, practical/research/fieldwork courses, existing named-subject slots, unassigned/shared-teacher slots and XI/XII/Degree are excluded from automatic assignment. Visibility in Course Distribution does not remove a teaching assignment. Known inactive/missing catalogue courses are excluded when the catalogue loads; offline fallback uses saved assignments.

The shared resolver always uses the complete routine, so filtering by day/class/teacher never restarts the cycle. Admin cards, student Now/Next, full/filtered routines, CSV and both print paths resolve the same course. Assignment/filter display does not rewrite entries or publish drafts. New Subjects and teacher assignments are saved through the existing draft/preview/publish workflow; no SQL migration is required. Regression coverage includes wrapping cycles, explicit overrides, year/teacher isolation, filter invariance, catalogue selection/save, failed reads and admin/student print parity.

### Compact full routine and XI/XII sections

The full unfiltered routine now deliberately omits course titles. Its screen (desktop/mobile) and landscape print use the shared `class-routine-format.js`: H1, H2, H3, H4, Msc, Degree, XI or XII; teacher symbolic codes; optional room in parentheses; then XI/XII section. Multiple teacher codes are separated by `/`. A teacherless non-major entry substitutes a subject symbol: Eco, SW, PS, Bot, Zoo, Ban, Eng or ICT. Examples: `H1-AM (408)`, `H2-Eco (703)`, `XI-AM (702) Humanities-C`.

The class editor exposes an optional Section field only for XI/XII. It saves in the existing entry JSON, has an 80-character validation limit, and supports Humanities-A/B/C, Bus, Science and other section text. Existing recognizable section details are displayed as a fallback until edited. An explicitly empty section suppresses that fallback. Other academic levels ignore this field. Class-wise/teacher-wise prints, Now/Next and the underlying course rotation retain their course names. No SQL or publication is performed automatically.

Formatter, UI/print parity and admin save/reopen tests pass. A rendered full-routine sample was verified visually as one A4 landscape page with the teacher directory and signature retained, without full subject titles.
