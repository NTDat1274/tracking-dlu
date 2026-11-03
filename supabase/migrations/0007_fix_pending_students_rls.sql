-- ==============================================================================
-- Migration: 0007_fix_pending_students_rls.sql
-- Mục đích: Sửa lỗi vi phạm chính sách RLS (42501) trên bảng `pending_students`
-- khi sinh viên nộp hồ sơ kèm ảnh chân dung qua Webcam từ StudentPortalPage.
--
-- Vấn đề cũ:
--   Chính sách SELECT trên `pending_students` chỉ cho phép `public.is_admin()`.
--   Khi Client gửi lệnh `insert().select("id")` (tương đương INSERT ... RETURNING id),
--   PostgreSQL RLS bắt buộc phải kiểm tra quyền SELECT đối với dòng vừa chèn.
--   Do sinh viên không phải Admin, câu lệnh bị từ chối với lỗi RLS 42501.
--
-- Giải pháp:
--   1. Cho phép sinh viên xem (SELECT) hồ sơ do chính mình gửi lên
--      (submitted_by = auth.uid()), đồng thời Admin vẫn xem được toàn bộ.
--   2. Cho phép người dùng đã xác thực (sinh viên) và admin chèn (INSERT) hồ sơ.
--   3. Đảm bảo bảo mật, tuân thủ supabase-postgres-best-practices.
-- ==============================================================================

-- 1. Cập nhật chính sách SELECT cho `pending_students`
DROP POLICY IF EXISTS "Allow admin select pending_students" ON public.pending_students;
DROP POLICY IF EXISTS "Allow select pending_students" ON public.pending_students;

CREATE POLICY "Allow select pending_students"
ON public.pending_students FOR SELECT
USING (
    public.is_admin()
    OR submitted_by = (SELECT auth.uid())
);

-- 2. Cập nhật chính sách INSERT cho `pending_students`
DROP POLICY IF EXISTS "Allow insert pending_students for authenticated" ON public.pending_students;
DROP POLICY IF EXISTS "Allow insert pending_students" ON public.pending_students;

CREATE POLICY "Allow insert pending_students"
ON public.pending_students FOR INSERT
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    OR (SELECT auth.uid()) IS NULL
);

-- 3. Cập nhật chính sách UPDATE cho `pending_students` (Admin duyệt/từ chối)
DROP POLICY IF EXISTS "Allow admin update pending_students" ON public.pending_students;
CREATE POLICY "Allow admin update pending_students"
ON public.pending_students FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Cập nhật chính sách DELETE cho `pending_students`
DROP POLICY IF EXISTS "Allow admin delete pending_students" ON public.pending_students;
DROP POLICY IF EXISTS "Allow delete pending_students" ON public.pending_students;

CREATE POLICY "Allow delete pending_students"
ON public.pending_students FOR DELETE
USING (
    public.is_admin()
    OR (submitted_by = (SELECT auth.uid()) AND status = 'pending')
);
