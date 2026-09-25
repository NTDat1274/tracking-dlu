-- ==============================================================================
-- Migration: 0004_create_accounts_table.sql
-- Mục đích: Tạo bảng accounts phân quyền (Role-based) cho Quản trị viên và Sinh viên
-- Tuân thủ đầy đủ các quy tắc: supabase-postgres-best-practices
-- ==============================================================================

-- 1. Tạo bảng accounts liên kết với auth.users và public.students
-- (schema-primary-keys & schema-data-types & schema-constraints)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    student_id TEXT UNIQUE REFERENCES public.students(student_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Đánh Index cho tất cả các Foreign Keys và cột phân loại thường lọc (schema-foreign-key-indexes & query-missing-indexes)
CREATE INDEX IF NOT EXISTS accounts_student_id_idx ON public.accounts(student_id);
CREATE INDEX IF NOT EXISTS accounts_role_idx ON public.accounts(role);

-- 3. Tạo hàm kiểm tra vai trò Quản trị viên tối ưu (security-rls-performance)
-- Sử dụng SECURITY DEFINER và STABLE để tránh đệ quy RLS và tối ưu cache execution plan
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

-- 4. Bật Row Level Security (RLS) cho bảng accounts (security-rls-basics)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Policy xem tài khoản: Người dùng xem tài khoản chính mình HOẶC Admin xem toàn bộ
DROP POLICY IF EXISTS "Users can view own account or admin all" ON public.accounts;
CREATE POLICY "Users can view own account or admin all"
ON public.accounts FOR SELECT
USING (
  (SELECT auth.uid()) = id OR public.is_admin()
);

-- Policy cập nhật tài khoản: Người dùng cập nhật tài khoản chính mình HOẶC Admin cập nhật
DROP POLICY IF EXISTS "Users can update own account or admin all" ON public.accounts;
CREATE POLICY "Users can update own account or admin all"
ON public.accounts FOR UPDATE
USING (
  (SELECT auth.uid()) = id OR public.is_admin()
)
WITH CHECK (
  (SELECT auth.uid()) = id OR public.is_admin()
);

-- Policy cho phép insert tài khoản (dành cho authenticated user và trigger)
DROP POLICY IF EXISTS "Users can insert own account" ON public.accounts;
CREATE POLICY "Users can insert own account"
ON public.accounts FOR INSERT
WITH CHECK (
  (SELECT auth.uid()) = id OR public.is_admin()
);

-- 5. Trigger tự động tạo bản ghi trong accounts khi người dùng đăng ký qua auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Đồng bộ các user hiện có trong auth.users vào accounts nếu chưa tồn tại
-- Gán role 'admin' cho tài khoản hiện có để không làm mất quyền quản trị
INSERT INTO public.accounts (id, email, role)
SELECT 
  u.id,
  u.email,
  'admin' -- Mặc định các tài khoản đã tồn tại trước đó là admin
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts a WHERE a.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- 7. Cập nhật RLS cho bảng students để sinh viên được cập nhật hồ sơ cá nhân
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow student upsert own profile or admin all" ON public.students;
CREATE POLICY "Allow student upsert own profile or admin all"
ON public.students FOR ALL
USING (
  public.is_admin()
  OR student_id IN (
    SELECT a.student_id FROM public.accounts a WHERE a.id = (SELECT auth.uid())
  )
  -- Cho phép sinh viên tạo hồ sơ mới nếu tài khoản chưa liên kết student_id
  OR NOT EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = (SELECT auth.uid()) AND a.student_id IS NOT NULL
  )
  -- Hoặc tài khoản khách ẩn danh đọc danh sách nếu cần
  OR (SELECT auth.uid()) IS NULL
)
WITH CHECK (
  public.is_admin()
  OR student_id IN (
    SELECT a.student_id FROM public.accounts a WHERE a.id = (SELECT auth.uid())
  )
  OR NOT EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = (SELECT auth.uid()) AND a.student_id IS NOT NULL
  )
);

-- 8. Cập nhật RLS cho bảng student_records để sinh viên xem được lịch sử của chính mình
ALTER TABLE public.student_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow student view own records or admin all" ON public.student_records;
CREATE POLICY "Allow student view own records or admin all"
ON public.student_records FOR SELECT
USING (
  public.is_admin()
  OR student_id IN (
    SELECT a.student_id FROM public.accounts a WHERE a.id = (SELECT auth.uid())
  )
  OR (SELECT auth.uid()) IS NULL
);
