-- Tạo bảng cameras để lưu trạng thái kết nối (heartbeat)
CREATE TABLE IF NOT EXISTS public.cameras (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    fps INTEGER,
    status TEXT, -- 'Connected', 'Offline'
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bật Realtime cho bảng cameras
ALTER PUBLICATION supabase_realtime ADD TABLE public.cameras;

-- Cấu hình bảo mật RLS để cho phép đọc/ghi tự do từ Dashboard và App
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on cameras" ON public.cameras FOR ALL USING (true) WITH CHECK (true);
