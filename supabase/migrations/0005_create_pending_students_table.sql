-- ==============================================================================
-- Migration: 0005_create_pending_students_table.sql
-- Mục đích (Task 4.1): Tạo bảng `pending_students` lưu trữ các hồ sơ sinh
-- viên do Cổng Sinh viên (StudentPortalPage) hoặc Admin gửi lên qua Webcam.
-- Mỗi hồ sơ phải được Admin phê duyệt thủ công (status='approved') trước
-- khi được promote sang bảng `students` chính và đồng bộ về Desktop App.
-- Tuân thủ supabase-postgres-best-practices (PK/Indexes/RLS/CHECK constraints).
-- ==============================================================================

-- 1. Bảng `pending_students`
CREATE TABLE IF NOT EXISTS public.pending_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    class_name TEXT,
    email TEXT,
    portrait_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    review_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Index phục vụ lọc theo trạng thái và sắp xếp thời gian tạo.
-- Đây là truy vấn nóng trên Admin Approval Dashboard.
CREATE INDEX IF NOT EXISTS pending_students_status_idx
    ON public.pending_students (status);
CREATE INDEX IF NOT EXISTS pending_students_created_at_idx
    ON public.pending_students (created_at DESC);
CREATE INDEX IF NOT EXISTS pending_students_student_id_idx
    ON public.pending_students (student_id);

-- 3. Row Level Security
ALTER TABLE public.pending_students ENABLE ROW LEVEL SECURITY;

-- Student hoặc Admin đều có thể gửi (INSERT) hồ sơ mới.
DROP POLICY IF EXISTS "Allow insert pending_students for authenticated" ON public.pending_students;
CREATE POLICY "Allow insert pending_students for authenticated"
ON public.pending_students FOR INSERT
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    OR (SELECT auth.uid()) IS NULL
);

-- Chỉ Admin được xem toàn bộ danh sách pending_students.
DROP POLICY IF EXISTS "Allow admin select pending_students" ON public.pending_students;
CREATE POLICY "Allow admin select pending_students"
ON public.pending_students FOR SELECT
USING (public.is_admin());

-- Chỉ Admin được cập nhật trạng thái phê duyệt.
DROP POLICY IF EXISTS "Allow admin update pending_students" ON public.pending_students;
CREATE POLICY "Allow admin update pending_students"
ON public.pending_students FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Cho phép xóa các bản ghi pending (ví dụ: student nộp lại hồ sơ).
DROP POLICY IF EXISTS "Allow admin delete pending_students" ON public.pending_students;
CREATE POLICY "Allow admin delete pending_students"
ON public.pending_students FOR DELETE
USING (public.is_admin());

-- 4. Bật Realtime để Admin Dashboard nhận event INSERT/UPDATE/DELETE
-- ngay khi sinh viên gửi hồ sơ mới.
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_students;
