-- Apply Supabase Postgres Best Practices

-- 1. Index Foreign Key Columns (schema-foreign-key-indexes)
-- student_records has a foreign key to students(student_id) which was unindexed.
CREATE INDEX IF NOT EXISTS student_records_student_id_idx ON public.student_records (student_id);

-- 2. Add Foreign Key constraint for camera_id and Index it (schema-foreign-key-indexes & query-missing-indexes)
-- camera_id in student_records relates to cameras(id) but lacked a constraint and index.
ALTER TABLE public.student_records
  ADD CONSTRAINT student_records_camera_id_fkey 
  FOREIGN KEY (camera_id) 
  REFERENCES public.cameras(id) 
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS student_records_camera_id_idx ON public.student_records (camera_id);

-- 3. Add Indexes on commonly filtered columns (query-missing-indexes)
-- Dashboards frequently filter by time.
CREATE INDEX IF NOT EXISTS student_records_time_in_idx ON public.student_records (time_in);
CREATE INDEX IF NOT EXISTS student_records_created_at_idx ON public.student_records (created_at);

-- 4. Default UUID value (schema-primary-keys)
-- Provide a default generator for UUID to avoid requiring client-side generation.
ALTER TABLE public.student_records ALTER COLUMN id SET DEFAULT gen_random_uuid();
