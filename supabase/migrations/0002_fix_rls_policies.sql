-- Kịch bản thêm RLS Policies để Web Dashboard có quyền Insert/Update
-- Chạy đoạn script này trong mục SQL Editor của Supabase

-- Bật RLS cho bảng students (nếu chưa bật)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Tạo policy cho phép thao tác (Web Dashboard sử dụng anon key)
CREATE POLICY "Allow anon select to students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow anon insert to students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update to students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete to students" ON public.students FOR DELETE USING (true);

-- Đảm bảo student_records cũng có policy tương tự
ALTER TABLE public.student_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on student_records" ON public.student_records FOR ALL USING (true) WITH CHECK (true);
