-- ==============================================================================
-- Migration: 0008_fix_students_table_permissions.sql
-- Mục đích: Khôi phục quyền thao tác bảng cho role `authenticated` (Admin trên Web)
-- để thực hiện phê duyệt sinh viên (upsert vào bảng `students`) và quản lý giảng viên.
--
-- Lý do:
--   Migration 0006 trước đó chạy `REVOKE ALL ON public.students FROM anon, authenticated`,
--   tước mất table-level grant của role `authenticated`. Do Admin trên Web đăng nhập
--   qua Supabase Auth cũng thuộc role `authenticated`, mọi câu lệnh upsert/delete
--   đều bị PostgreSQL chặn ngay ở lớp kiểm tra quyền bảng với lỗi:
--   `ERROR 42501: permission denied for table students`.
--
-- Tính bảo mật:
--   Được kiểm soát 100% qua các chính sách Row Level Security (RLS) đã có:
--     - `students_admin_all`: Admin (public.is_admin()) toàn quyền trên mọi dòng.
--     - `students_owner_select_update`: Sinh viên chỉ xem/sửa hồ sơ của chính mình.
--     - `students_anon_read_minimal`: Khách vãng lai chỉ đọc tối thiểu phục vụ UI.
-- ==============================================================================

-- 1. Khôi phục quyền bảng `students`
GRANT ALL ON public.students TO authenticated;
GRANT SELECT ON public.students TO anon;

-- 2. Khôi phục quyền bảng `lecturers` nếu tồn tại
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lecturers') THEN
    EXECUTE 'GRANT ALL ON public.lecturers TO authenticated';
    EXECUTE 'GRANT SELECT ON public.lecturers TO anon';
  END IF;
END $$;
