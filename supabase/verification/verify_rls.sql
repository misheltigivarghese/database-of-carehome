-- ============================================================================
-- verify_rls.sql  —  AMD Act III Healthcare: RLS / schema self-test
-- ----------------------------------------------------------------------------
-- WHAT IT DOES
--   Seeds two throwaway users (one admin, one care_staff) plus two throwaway
--   residents inside a single transaction, impersonates each user, and asserts
--   that the Row Level Security policies behave as intended.
--
-- WHY IT IS SAFE
--   The whole block runs in ONE implicit transaction and deliberately ends with
--   RAISE EXCEPTION. That aborts and rolls back everything — no users, rows,
--   notes or objects are ever persisted. The exception message *is* the report.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> paste this file -> Run.
--   Or via an MCP tool:  execute_sql(project_id, <this file's body>).
--
-- EXPECTED OUTPUT
--   An ERROR whose message begins "QA_RLS_REPORT ..." followed by a JSON array.
--   EVERY entry must have "result" containing "OK".  A "FAIL" means a policy
--   regression. Nothing in the database is modified.
-- ============================================================================

do $$
declare
  v_orig   text := current_user;
  v_admin  uuid := gen_random_uuid();
  v_staff  uuid := gen_random_uuid();
  v_res    uuid := gen_random_uuid();
  v_res2   uuid := gen_random_uuid();
  v_role   text;
  v_author uuid;
  v_cnt    int;
  n        int;
  v_report jsonb := '[]'::jsonb;
begin
  -- Seed. handle_new_user() promotes the FIRST profile to admin, so insert the
  -- admin candidate first, then force both roles explicitly for determinism.
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-admin@example.test', now(), now(), now()),
    (v_staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-staff@example.test', now(), now(), now());

  update public.profiles set role = 'admin'      where user_id = v_admin;
  update public.profiles set role = 'care_staff' where user_id = v_staff;
  insert into public.residents (id, name, room_number) values (v_res,  'QA Temp Resident',   'QA-1');
  insert into public.residents (id, name, room_number) values (v_res2, 'QA Temp Resident 2', 'QA-2');

  -- ================= care_staff context =================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_staff::text, 'role', 'authenticated')::text, true);

  delete from public.residents where id = v_res2;
  get diagnostics n = row_count;
  v_report := v_report || jsonb_build_object('check','care_staff DELETE resident','rows',n,'expect',0,'result', case when n=0 then 'DENIED OK' else 'ALLOWED FAIL' end);

  begin
    insert into public.documents (resident_id, storage_path, file_name, mime_type) values (v_res,'qa/tmp.pdf','tmp.pdf','application/pdf');
    get diagnostics n = row_count;
    v_report := v_report || jsonb_build_object('check','care_staff INSERT public.documents','rows',n,'expect',0,'result', case when n=0 then 'DENIED OK' else 'ALLOWED FAIL' end);
  exception when others then
    v_report := v_report || jsonb_build_object('check','care_staff INSERT public.documents','rows',0,'expect',0,'result','DENIED OK (raise)','sqlstate',SQLSTATE);
  end;

  begin
    insert into storage.objects (bucket_id, name, owner) values ('resident-documents','qa/tmp.pdf', v_staff);
    get diagnostics n = row_count;
    v_report := v_report || jsonb_build_object('check','care_staff INSERT storage.objects','rows',n,'expect',0,'result', case when n=0 then 'DENIED OK' else 'ALLOWED FAIL' end);
  exception when others then
    v_report := v_report || jsonb_build_object('check','care_staff INSERT storage.objects','rows',0,'expect',0,'result','DENIED OK (raise)','sqlstate',SQLSTATE);
  end;

  update public.profiles set role = 'admin' where user_id = v_staff;
  get diagnostics n = row_count;
  v_report := v_report || jsonb_build_object('check','care_staff self-promote to admin','rows',n,'expect',0,'result', case when n=0 then 'DENIED OK' else 'ALLOWED FAIL' end);

  select role into v_role from public.profiles where user_id = v_staff;
  v_report := v_report || jsonb_build_object('check','care_staff role after promote attempt','role',v_role,'expect','care_staff','result', case when v_role='care_staff' then 'OK' else 'FAIL' end);

  select count(*) into v_cnt from public.residents where id = v_res;
  v_report := v_report || jsonb_build_object('check','care_staff SELECT resident','rows',v_cnt,'expect',1,'result', case when v_cnt=1 then 'ALLOWED OK' else 'FAIL' end);

  insert into public.care_notes (resident_id, body) values (v_res,'QA positive control note');
  get diagnostics n = row_count;
  select author_id into v_author from public.care_notes where resident_id = v_res;
  v_report := v_report || jsonb_build_object('check','care_staff INSERT own care_note','rows',n,'expect',1,'author_is_self',(v_author = v_staff),'result', case when n=1 and v_author=v_staff then 'ALLOWED OK' else 'FAIL' end);

  -- ================= admin context =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);

  update public.profiles set role = 'care_staff' where user_id = v_staff;
  get diagnostics n = row_count;
  v_report := v_report || jsonb_build_object('check','admin UPDATE other profile','rows',n,'expect',1,'result', case when n=1 then 'ALLOWED OK' else 'FAIL' end);

  insert into public.documents (resident_id, storage_path, file_name, mime_type) values (v_res,'qa/tmp3.pdf','tmp3.pdf','application/pdf');
  get diagnostics n = row_count;
  v_report := v_report || jsonb_build_object('check','admin INSERT public.documents','rows',n,'expect',1,'result', case when n=1 then 'ALLOWED OK' else 'FAIL' end);

  insert into storage.objects (bucket_id, name, owner) values ('resident-documents','qa/tmp3.pdf', v_admin);
  get diagnostics n = row_count;
  v_report := v_report || jsonb_build_object('check','admin INSERT storage.objects','rows',n,'expect',1,'result', case when n=1 then 'ALLOWED OK' else 'FAIL' end);

  delete from public.residents where id = v_res2;
  get diagnostics n = row_count;
  v_report := v_report || jsonb_build_object('check','admin DELETE resident','rows',n,'expect',1,'result', case when n=1 then 'ALLOWED OK' else 'FAIL' end);

  perform set_config('role', v_orig, true);
  raise exception 'QA_RLS_REPORT (intentional rollback - nothing persisted): %', v_report::text;
end $$;
