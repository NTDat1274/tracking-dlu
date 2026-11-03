-- ==============================================================================
-- Migration: 0006_security_rls_hardening.sql
-- Muc dich (Task 5.1): Gia co bao mat & an toan he thong (Security Enhancements).
--
-- 1. Dam bao chi su dung VITE_SUPABASE_ANON_KEY an toan o phia Client (chiu su
--    dieu tiet cua RLS). Tuyet doi khong de lo Service Role Key o client.
-- 2. Bat Row Level Security (RLS) tren tat ca bang nghiep vu va thay the cac
--    policy anon mo rong (`USING (true)`) bang policy phan quyen toi thieu:
--      - Admin (public.is_admin()): full quyen.
--      - Sinh vien: chi xem/sua ho so cua chinh minh (map qua accounts).
--      - Anon/visitor: chi duoc doc toi thieu phuc vu UI (khong insert/update).
-- 3. Khoa cot nhay cam `embedding` (vector 512-D): chi admin duoc doc/ghi,
--    ngan chan anon truy van tr	Tuc tiep vector sinh trac hoc.
-- 4. Tao helper `is_lecturer()` + policy cho bang `lecturers` va `cameras`.
-- 5. Danh index cho cac cot loc nong (status, time_in, created_at).
-- Tuan thu: supabase-postgres-best-practices (PK/index/RLS/CHECK).
-- ==============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper phan quyen (SECURITY DEFINER, STABLE, tranh de quy RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = (SELECT auth.uid()) AND role IN ('lecturer', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Bat RLS tren tat ca bang nghiep vu (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lecturers') THEN
    EXECUTE 'ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pending_students') THEN
    EXECUTE 'ALTER TABLE public.pending_students ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Go bo cac policy anon mo rong cu (USING (true) / FOR ALL) de tranh ro ri
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anon select to students" ON public.students;
DROP POLICY IF EXISTS "Allow anon insert to students" ON public.students;
DROP POLICY IF EXISTS "Allow anon update to students" ON public.students;
DROP POLICY IF EXISTS "Allow anon delete to students" ON public.students;
DROP POLICY IF EXISTS "Allow anon all on student_records" ON public.student_records;

-- ---------------------------------------------------------------------------
-- 3. Bang `students`: toi thieu hoa quyen
--    - Admin: full.
--    - Sinh vien: xem/sua ho so cua chinh minh (qua accounts.student_id).
--    - Anon: chi duoc doc toi thieu (khong embedding, phuc vu UI directory).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "students_admin_all" ON public.students;
CREATE POLICY "students_admin_all"
ON public.students FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "students_owner_select_update" ON public.students;
CREATE POLICY "students_owner_select_update"
ON public.students FOR SELECT
USING (
  public.is_admin()
  OR student_id IN (
    SELECT a.student_id FROM public.accounts a WHERE a.id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "students_owner_update" ON public.students;
CREATE POLICY "students_owner_update"
ON public.students FOR UPDATE
USING (
  public.is_admin()
  OR student_id IN (
    SELECT a.student_id FROM public.accounts a WHERE a.id = (SELECT auth.uid())
  )
)
WITH CHECK (
  public.is_admin()
  OR student_id IN (
    SELECT a.student_id FROM public.accounts a WHERE a.id = (SELECT auth.uid())
  )
);

-- Sinh vien tu tao ho so lan dau neu tai khoan chua lien ket student_id.
DROP POLICY IF EXISTS "students_self_insert" ON public.students;
CREATE POLICY "students_self_insert"
ON public.students FOR INSERT
WITH CHECK (
  public.is_admin()
  OR NOT EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = (SELECT auth.uid()) AND a.student_id IS NOT NULL
  )
);

-- Anon chi doc directory toi thieu (khong bao gom embedding). Cot embedding
-- duoc khoa them bang policy rieng o muc 6 (chi admin).
DROP POLICY IF EXISTS "students_anon_read_minimal" ON public.students;
CREATE POLICY "students_anon_read_minimal"
ON public.students FOR SELECT
USING ((SELECT auth.uid()) IS NULL);

-- ---------------------------------------------------------------------------
-- 4. Bang `student_records`: nhat ky ra/vao
--    - Admin: full.
--    - Sinh vien: chi xem ban ghi cua chinh minh.
--    - Ghi (insert/update/delete): chi admin + service backend (service_role).
--      Desktop App dong bo qua service_role o server, khong dung anon key.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "records_admin_all" ON public.student_records;
CREATE POLICY "records_admin_all"
ON public.student_records FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "records_owner_select" ON public.student_records;
CREATE POLICY "records_owner_select"
ON public.student_records FOR SELECT
USING (
  public.is_admin()
  OR student_id IN (
    SELECT a.student_id FROM public.accounts a WHERE a.id = (SELECT auth.uid())
  )
);

-- Lecturers chi duoc doc lich su (read-only) phuc vu cong tra cuu.
DROP POLICY IF EXISTS "records_lecturer_readonly" ON public.student_records;
CREATE POLICY "records_lecturer_readonly"
ON public.student_records FOR SELECT
USING (public.is_lecturer());

-- ---------------------------------------------------------------------------
-- 5. Bang `lecturers`: ho so giang vien
--    - Admin: full.
--    - Lecturer: xem/sua ho so cua chinh minh (can mo rong map khi co lien ket).
--    - Anon: khong duoc doc embedding.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lecturers') THEN
    EXECUTE 'DROP POLICY IF EXISTS "lecturers_admin_all" ON public.lecturers';
    EXECUTE 'CREATE POLICY "lecturers_admin_all" ON public.lecturers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "lecturers_readonly" ON public.lecturers';
    EXECUTE 'CREATE POLICY "lecturers_readonly" ON public.lecturers FOR SELECT USING (public.is_lecturer() OR (SELECT auth.uid()) IS NULL)';

    EXECUTE 'DROP POLICY IF EXISTS "lecturers_self_update" ON public.lecturers';
    EXECUTE 'CREATE POLICY "lecturers_self_update" ON public.lecturers FOR UPDATE USING (public.is_lecturer()) WITH CHECK (public.is_lecturer())';

    EXECUTE 'DROP POLICY IF EXISTS "lecturers_self_insert" ON public.lecturers';
    EXECUTE 'CREATE POLICY "lecturers_self_insert" ON public.lecturers FOR INSERT WITH CHECK (public.is_lecturer())';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Khoa cot `embedding` (vector sinh trac hoc 512-D)
--    Nguyen tac: chi admin duoc doc/ghi embedding. Anon/authenticated thuong
--    bi chan o tang policy bang cach REVOKE + chi grant lai cot khong nhay cam.
--    Luu y: Supabase PostgREST ton trong GRANT cot, RLS policy o tren van giu.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'embedding'
  ) THEN
    EXECUTE 'REVOKE ALL ON public.students FROM anon, authenticated';
    EXECUTE 'GRANT SELECT (student_id, full_name, class_name, email, portrait_url, created_at) ON public.students TO anon, authenticated';
    EXECUTE 'GRANT INSERT (student_id, full_name, class_name, email, portrait_url) ON public.students TO authenticated';
    EXECUTE 'GRANT UPDATE (full_name, class_name, email, portrait_url) ON public.students TO authenticated';
    -- Admin (service_role / postgres) van full quyen qua RLS + ownership.
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lecturers' AND column_name = 'embedding'
  ) THEN
    EXECUTE 'REVOKE ALL ON public.lecturers FROM anon, authenticated';
    EXECUTE 'GRANT SELECT (id, lecturer_code, full_name, department, avatar_url, created_at) ON public.lecturers TO anon, authenticated';
    EXECUTE 'GRANT INSERT (lecturer_code, full_name, department, avatar_url) ON public.lecturers TO authenticated';
    EXECUTE 'GRANT UPDATE (full_name, department, avatar_url) ON public.lecturers TO authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Bang `cameras` (heartbeat): UI chi doc; chi admin/service duoc ghi
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cameras_public_read" ON public.cameras;
CREATE POLICY "cameras_public_read"
ON public.cameras FOR SELECT
USING (true);

DROP POLICY IF EXISTS "cameras_admin_write" ON public.cameras;
CREATE POLICY "cameras_admin_write"
ON public.cameras FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. Index cho cac cot loc nong (query-missing-indexes)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS student_records_status_idx ON public.student_records (status);
CREATE INDEX IF NOT EXISTS student_records_time_in_idx ON public.student_records (time_in DESC);
CREATE INDEX IF NOT EXISTS student_records_created_at_idx ON public.student_records (created_at DESC);
CREATE INDEX IF NOT EXISTS student_records_student_id_idx ON public.student_records (student_id);
CREATE INDEX IF NOT EXISTS students_class_name_idx ON public.students (class_name);

-- ---------------------------------------------------------------------------
-- 9. Dam bao Realtime publication cho cac bang can thiet
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.student_records';
  EXCEPTION WHEN duplicate_object THEN
    -- Da co trong publication, bo qua.
  END;
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lecturers') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.lecturers';
    END IF;
  EXCEPTION WHEN duplicate_object THEN
    -- Da co, bo qua.
  END;
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cameras') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cameras';
    END IF;
  EXCEPTION WHEN duplicate_object THEN
    -- Da co, bo qua.
  END;
END $$;
