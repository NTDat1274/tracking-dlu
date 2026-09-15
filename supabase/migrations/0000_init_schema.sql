-- ==============================================================================
-- Kịch bản khởi tạo Cơ sở dữ liệu Supabase cho TrackingZ
-- Chạy đoạn script này trong mục SQL Editor của Supabase
-- ==============================================================================

-- 1. Tạo bảng students
CREATE TABLE IF NOT EXISTS public.students (
    student_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    class_name TEXT,
    email TEXT,
    portrait_url TEXT,
    embedding TEXT, -- Tạm thời lưu dạng chuỗi JSON hoặc thay đổi sang vector nếu có pgvector
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tạo bảng student_records
CREATE TABLE IF NOT EXISTS public.student_records (
    id UUID PRIMARY KEY,
    track_id BIGINT,
    student_id TEXT REFERENCES public.students(student_id) ON DELETE SET NULL,
    student_name TEXT,
    time_in TIMESTAMP WITH TIME ZONE,
    time_out TIMESTAMP WITH TIME ZONE,
    duration_seconds REAL,
    status TEXT,
    similarity_score REAL,
    camera_id TEXT,
    snapshot_url TEXT,
    best_crop TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bật Realtime cho bảng student_records để Web Dashboard có thể nhận events
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_records;
