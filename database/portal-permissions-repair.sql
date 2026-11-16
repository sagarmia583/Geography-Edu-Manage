-- Geography portal: run this ENTIRE file in this project's Supabase SQL Editor
-- as postgres. Admin: sagarmia583@gmail.com. No UUID needs to be pasted.
-- Preserves business rows, passwords, existing permissive policies and other apps.
-- Extends restrictive policies ONLY for this named admin; other users retain
-- their existing conditions. Does not make student/marks data publicly readable.
-- Review the final report: SQL cannot fix expired login tokens or UI bugs.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TEMP TABLE IF NOT EXISTS geo_portal_repair_report (
  severity text, object_name text, detail text
);
TRUNCATE pg_temp.geo_portal_repair_report;

CREATE TEMP TABLE IF NOT EXISTS geo_portal_expected (
  table_name text PRIMARY KEY, columns_expected text[]
);
TRUNCATE pg_temp.geo_portal_expected;
-- SCHEMA_CONTRACT_START
INSERT INTO pg_temp.geo_portal_expected (table_name, columns_expected) VALUES
  ('admins', ARRAY['row_id','Timestamp','AdminID','Name','Username','Password','Role','Email','Mobile','ImageURL','Status']),
  ('students', ARRAY['row_id','Timestamp','StudentID','SessionYear','CurrentYear','Name','Roll','RegistrationNumber','FatherName','MotherName','Address','Email','StudentPhone','GuardianPhone','StudentMobile','GuardianMobile','NonMajorGroup','NonMajor1','NonMajor2','Group','PhotoURL','ImageURL','Password','Status','StudySessionYear','CurrentStudySession','AcademicYear','StudyStatus']),
  ('actualstudents', ARRAY['row_id','Timestamp','StudentID','Name','Roll','RegistrationNumber','FatherName','MotherName','Address','Email','StudentMobile','GuardianMobile','SessionYear','StudySessionYear','AcademicYear','CurrentYear','NonMajorGroup','Group','Status','StudyStatus']),
  ('subjects', ARRAY['row_id','Timestamp','SubjectID','AcademicYear','SubjectType','SubjectCode','SubjectName','FullMarks','PassMarks','Credits','Group','Status']),
  ('studentsubjects', ARRAY['row_id','Timestamp','StudentSubjectID','SessionYear','AcademicYear','Roll','RegistrationNumber','StudentName','SubjectCodes','SubjectNames','SubjectTypes','SubjectCode','SubjectName','SubjectType','NonMajorGroup','Status']),
  ('nonmajorgroups', ARRAY['row_id','Timestamp','GroupID','AcademicYear','GroupName','SubjectCodes','SubjectNames','Status']),
  ('exams', ARRAY['row_id','Timestamp','ExamID','SessionYear','AcademicYear','ExamType','ExamName','StartDate','Status','ExamComponentMarks','AssignmentMarks','AttendanceMarks','TestExamMarks','FinalPassMarks','PromotionExam','ResultPublished','PublishedAt','Published','PublishStatus']),
  ('examschedule', ARRAY['row_id','Timestamp','ScheduleID','ExamID','SessionYear','AcademicYear','ExamType','ExamName','SubjectCode','SubjectName','ExamDate','ExamTime','Room','Note','Status','SubjectExamMarks','SubjectAssignmentMarks','SubjectAttendanceMarks','SubjectTestMarks','SubjectFinalPassMarks','SubjectFullMarks']),
  ('examblocks', ARRAY['row_id','Timestamp','ExamID','SessionYear','AcademicYear','ExamType','Roll','RegistrationNumber','StudentName','Blocked','Reason','Status']),
  ('marks', ARRAY['row_id','Timestamp','MarkID','ExamID','SessionYear','AcademicYear','ExamType','SubjectCode','SubjectName','Roll','RegistrationNumber','StudentName','ExamMarks','AssignmentMarks','AttendanceMarks','Marks','Grade','GPA','PassFail','Status']),
  ('attendancemarks', ARRAY['row_id','Timestamp','AttendanceMarkID','ExamID','SessionYear','AcademicYear','ExamType','SubjectCode','SubjectName','Roll','RegistrationNumber','StudentName','AttendanceMarks','MaxAttendanceMarks','Remarks','Status']),
  ('Attendance', ARRAY['row_id','Timestamp','AttendanceID','ExamID','SessionYear','AcademicYear','SubjectCode','Roll','RegistrationNumber','StudentName','Status','Remarks']),
  ('resultsummary', ARRAY['row_id','Timestamp','SummaryID','ExamID','SessionYear','AcademicYear','ExamType','ExamName','Roll','RegistrationNumber','StudentName','SubjectCount','Passed','Failed','TotalMarks','GPA','Rank','Status','PassFail','FailedCodes','NonMajorGroup','Group','MarksJSON','ResultPublished','UpdatedAt']),
  ('finalresults', ARRAY['row_id','Timestamp','ResultID','SessionYear','AcademicYear','Roll','RegistrationNumber','StudentName','FinalMarks','GPA','ResultStatus','PromotedToYear','Remarks']),
  ('resultimports', ARRAY['row_id','Timestamp','ImportID','ExamID','InputSession','ResultYear','NextYear','RegNo','StudentNameFromFile','ObtainedGPMark','Result','Matched','MatchedRoll','MatchedStudentName','StudentSession','OldYear','NewYear','Message','SessionYear','AcademicYear','ExamType','FileName','Status']),
  ('Notices', ARRAY['row_id','Timestamp','NoticeID','Title','Body','Message','Audience','Status']),
  ('books', ARRAY['row_id','Timestamp','BookID','ISBN','Title','Author','Publisher','Category','Stock','Available','TotalCopies','AvailableCopies','PurchaseDate','BuyDate','Price','Status']),
  ('bookcopies', ARRAY['row_id','Timestamp','CopyID','ISBN','CopySerial','CopyCode','Title','Author','Category','PurchaseDate','Price','Status','BookID','Serial','Barcode','QR','IssuedRoll','IssuedName','RegistrationNumber','IssueDate','ReturnDate','SessionYear','AcademicYear','CurrentYear']),
  ('librarylogs', ARRAY['row_id','Timestamp','LogID','IssueID','Action','RollID','Roll','RegistrationNumber','StudentName','ISBN','BookID','CopyCode','CopyID','BookTitle','Title','IssueDate','ReturnDate','Status','Fine']),
  ('ClassRoutine', ARRAY['row_id','Timestamp','RoutineID','SessionYear','AcademicYear','Day','StartTime','EndTime','Time','SubjectCode','SubjectName','TeacherName','Teacher','Room','Status','Note']),
  ('ClassAttendance', ARRAY['row_id','Timestamp','AttendanceID','SessionYear','AcademicYear','Date','SubjectCode','SubjectName','Roll','RegistrationNumber','StudentName','Status','Remarks']),
  ('Teachers', ARRAY['row_id','Timestamp','TeacherID','Name','Designation','Phone','Mobile','Email','Status','Remarks']),
  ('StudentFees', ARRAY['row_id','Timestamp','FeeID','SessionYear','AcademicYear','Roll','RegistrationNumber','StudentName','Name','FeeType','Amount','Paid','Due','Transaction','Status','PaymentDate','Remarks']),
  ('Documents', ARRAY['row_id','Timestamp','DocumentID','Title','Category','FileURL','URL','Status','Note']),
  ('seminar_fee', ARRAY['id','admission_roll','fee_type','receipt_no','receipt_date','name','class_roll','registration_number','year','session','student_mobile','guardian_mobile','merit','migration','amount','amount_in_words','updated_at']);
-- SCHEMA_CONTRACT_END

DO $repair$
DECLARE
  admin_id uuid;
  admin_count integer;
  target record;
  policy_row record;
  sequence_row record;
  relation_id oid;
  missing_columns text;
  required_columns text;
  using_sql text;
  check_sql text;
  alter_sql text;
  duplicate_groups bigint;
  fee_key_exists boolean;
BEGIN
  SELECT count(*), (array_agg(id))[1] INTO admin_count, admin_id
  FROM auth.users WHERE lower(email) = lower('sagarmia583@gmail.com');
  IF admin_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Supabase Authentication user for sagarmia583@gmail.com; found %. No repair applied. Create/confirm the Auth account in this project first.', admin_count;
  END IF;
  IF to_regclass('public.students') IS NULL THEN
    RAISE EXCEPTION 'public.students is missing. Check that you opened the Geography portal Supabase project. No repair applied.';
  END IF;

  -- A private, non-writable helper; the admin UUID comes from Auth, not user metadata.
  CREATE SCHEMA IF NOT EXISTS geo_portal_security;
  REVOKE ALL ON SCHEMA geo_portal_security FROM PUBLIC;
  REVOKE CREATE ON SCHEMA geo_portal_security FROM anon, authenticated;
  -- Policies may also apply to custom database roles. They may evaluate this
  -- boolean helper, but cannot modify it or grant themselves admin access.
  GRANT USAGE ON SCHEMA geo_portal_security TO PUBLIC;
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION geo_portal_security.is_portal_admin() RETURNS boolean
     LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''''
     AS %L',
    format('SELECT COALESCE((SELECT auth.uid()) = %L::uuid, false)', admin_id::text)
  );
  REVOKE ALL ON FUNCTION geo_portal_security.is_portal_admin() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION geo_portal_security.is_portal_admin() TO PUBLIC;
  GRANT USAGE ON SCHEMA public TO authenticated;

  FOR target IN SELECT * FROM pg_temp.geo_portal_expected ORDER BY table_name LOOP
    relation_id := to_regclass(format('public.%I', target.table_name));
    IF relation_id IS NULL THEN
      INSERT INTO pg_temp.geo_portal_repair_report VALUES
        ('WARNING', target.table_name, 'Table absent with this exact case. Its feature needs a schema migration; no empty replacement table was created.');
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = relation_id AND relkind IN ('r','p')) THEN
      INSERT INTO pg_temp.geo_portal_repair_report VALUES
        ('WARNING', target.table_name, 'Not a regular/partitioned table; review view/function access separately.');
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE oid = relation_id AND NOT relrowsecurity) THEN
      INSERT INTO pg_temp.geo_portal_repair_report VALUES
        ('REVIEW', target.table_name, 'RLS was disabled. Enabled for admin-controlled access; public/student access now depends on existing policies.');
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', target.table_name);
    EXECUTE format('DROP POLICY IF EXISTS geo_portal_admin_all ON public.%I', target.table_name);
    EXECUTE format(
      'CREATE POLICY geo_portal_admin_all ON public.%I AS PERMISSIVE FOR ALL TO authenticated
       USING ((SELECT geo_portal_security.is_portal_admin()))
       WITH CHECK ((SELECT geo_portal_security.is_portal_admin()))', target.table_name
    );

    -- A permissive policy alone cannot pass an existing restrictive policy.
    -- Preserve each original condition, adding only the named admin exception.
    FOR policy_row IN
      SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS old_using,
             pg_get_expr(polwithcheck, polrelid) AS old_check
      FROM pg_policy WHERE polrelid = relation_id AND NOT polpermissive
    LOOP
      alter_sql := '';
      IF policy_row.polcmd IN ('r','w','d','*') THEN
        using_sql := coalesce(policy_row.old_using, 'true');
        IF position('geo_portal_security.is_portal_admin()' IN using_sql) = 0 THEN
          alter_sql := alter_sql || format(' USING (((SELECT geo_portal_security.is_portal_admin()) OR (%s)))', using_sql);
        END IF;
      END IF;
      IF policy_row.polcmd IN ('a','w','*') THEN
        check_sql := coalesce(policy_row.old_check, policy_row.old_using, 'true');
        IF position('geo_portal_security.is_portal_admin()' IN check_sql) = 0 THEN
          alter_sql := alter_sql || format(' WITH CHECK (((SELECT geo_portal_security.is_portal_admin()) OR (%s)))', check_sql);
        END IF;
      END IF;
      IF alter_sql <> '' THEN
        EXECUTE format('ALTER POLICY %I ON public.%I%s', policy_row.polname, target.table_name, alter_sql);
        INSERT INTO pg_temp.geo_portal_repair_report VALUES
          ('INFO', target.table_name, 'Added named-admin exception to restrictive policy: ' || policy_row.polname);
      END IF;
    END LOOP;

    -- serial / identity defaults need sequence access as well as INSERT access.
    FOR sequence_row IN
      SELECT DISTINCT pg_get_serial_sequence(format('public.%I', target.table_name), a.attname) AS sequence_name
      FROM pg_attribute a WHERE a.attrelid = relation_id AND a.attnum > 0 AND NOT a.attisdropped
    LOOP
      IF sequence_row.sequence_name IS NOT NULL THEN
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', sequence_row.sequence_name);
      END IF;
    END LOOP;

    SELECT string_agg(required_col, ', ' ORDER BY required_col) INTO missing_columns
    FROM unnest(target.columns_expected) AS required_col
    WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = relation_id
                      AND a.attname = required_col AND a.attnum > 0 AND NOT a.attisdropped);
    INSERT INTO pg_temp.geo_portal_repair_report VALUES
      ('OK', target.table_name, 'Named admin SELECT / INSERT / UPDATE / DELETE policy and sequence grants installed.');
    IF missing_columns IS NOT NULL THEN
      INSERT INTO pg_temp.geo_portal_repair_report VALUES
        ('WARNING', target.table_name, 'Columns expected by current code are absent: ' || missing_columns || '. Review types/defaults before adding; existing data was not changed.');
    END IF;
    SELECT string_agg(a.attname, ', ' ORDER BY a.attname) INTO required_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = relation_id AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attnotnull AND d.oid IS NULL AND a.attidentity = '' AND a.attgenerated = ''
      AND NOT (a.attname = ANY(target.columns_expected));
    IF required_columns IS NOT NULL THEN
      INSERT INTO pg_temp.geo_portal_repair_report VALUES
        ('WARNING', target.table_name, 'Extra NOT NULL columns with no default can reject inserts: ' || required_columns || '. The current adapter does not send them.');
    END IF;

    -- Existing broad policies are reported, never silently replaced.
    FOR policy_row IN
      SELECT policyname, cmd, roles FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target.table_name
        AND policyname <> 'geo_portal_admin_all' AND permissive = 'PERMISSIVE'
        AND (qual IN ('true','(true)') OR with_check IN ('true','(true)'))
    LOOP
      INSERT INTO pg_temp.geo_portal_repair_report VALUES
        ('REVIEW', target.table_name, format('Existing broad policy retained: %s / %s / %s. Public student reads may expose personal data or legacy passwords.', policy_row.policyname, policy_row.cmd, policy_row.roles));
    END LOOP;
  END LOOP;

  -- The fee page uses ON CONFLICT (admission_roll, fee_type).
  relation_id := to_regclass('public.seminar_fee');
  IF relation_id IS NOT NULL AND
     (SELECT count(*) FROM pg_attribute WHERE attrelid = relation_id
       AND attname IN ('admission_roll','fee_type') AND NOT attisdropped) = 2 THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_index i WHERE i.indrelid = relation_id
        AND i.indisunique AND i.indisvalid AND i.indimmediate
        AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts = 2
        AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
             FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, pos)
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
             WHERE k.pos <= i.indnkeyatts) = ARRAY['admission_roll','fee_type']::text[]
    ) INTO fee_key_exists;
    IF NOT fee_key_exists THEN
      -- Avoid concurrent inserts while checking/creating the key.
      LOCK TABLE public.seminar_fee IN SHARE ROW EXCLUSIVE MODE;
      SELECT count(*) INTO duplicate_groups FROM (
        SELECT admission_roll, fee_type FROM public.seminar_fee
        WHERE admission_roll IS NOT NULL AND fee_type IS NOT NULL
        GROUP BY admission_roll, fee_type HAVING count(*) > 1
      ) duplicates;
      IF duplicate_groups > 0 THEN
        INSERT INTO pg_temp.geo_portal_repair_report VALUES
          ('WARNING', 'seminar_fee', format('%s duplicate admission_roll + fee_type groups prevent the upsert key. Review duplicates; no payment records were deleted.', duplicate_groups));
      ELSIF to_regclass('public.geo_portal_seminar_fee_identity_uq') IS NOT NULL THEN
        INSERT INTO pg_temp.geo_portal_repair_report VALUES
          ('WARNING', 'seminar_fee', 'Index name geo_portal_seminar_fee_identity_uq is already used but does not match the required valid unique key. Review it.');
      ELSE
        CREATE UNIQUE INDEX geo_portal_seminar_fee_identity_uq ON public.seminar_fee (admission_roll, fee_type);
        INSERT INTO pg_temp.geo_portal_repair_report VALUES ('OK', 'seminar_fee', 'Created unique key (admission_roll, fee_type) for fee upsert.');
      END IF;
    ELSE
      INSERT INTO pg_temp.geo_portal_repair_report VALUES ('OK', 'seminar_fee', 'Fee upsert unique key already exists.');
    END IF;
  END IF;
  INSERT INTO pg_temp.geo_portal_repair_report VALUES
    ('INFO', 'Auth', 'Permission granted only to the Auth UUID resolved from sagarmia583@gmail.com. Other users were not made admins.');
END
$repair$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Keep the complete output, especially WARNING and REVIEW rows.
SELECT severity, object_name, detail FROM pg_temp.geo_portal_repair_report
ORDER BY CASE severity WHEN 'WARNING' THEN 0 WHEN 'REVIEW' THEN 1 WHEN 'OK' THEN 2 ELSE 3 END, object_name, detail;
