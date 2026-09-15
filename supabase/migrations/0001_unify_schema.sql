-- Migration to unify schema between TrackingZ (Desktop) and web_dashboard (Supabase)

-- 1. Unify `students` table
-- Ensure the primary key is `student_id` (If it was `id`, this is a complex migration. Assuming it is already `student_id` based on frontend code).

ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS class_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS portrait_url TEXT,
  ADD COLUMN IF NOT EXISTS embedding TEXT; 
-- Note: 'embedding' is stored as TEXT (JSON array) or you can use `vector` if pgvector is enabled:
-- ADD COLUMN IF NOT EXISTS embedding vector(512);

-- 2. Unify `student_records` table
-- Ensure id is UUID
-- Note: If `id` is currently an integer or something else, changing it to UUID requires dropping the column or doing a data migration.
-- Assuming `id` might already be UUID or we can alter it. If it's a bigserial, you might need to recreate the table.
-- Here we just add the missing columns.

ALTER TABLE public.student_records
  ADD COLUMN IF NOT EXISTS similarity_score REAL,
  ADD COLUMN IF NOT EXISTS best_crop TEXT,
  ADD COLUMN IF NOT EXISTS camera_id TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_url TEXT;

-- If `cloud_snapshot_url` exists, we rename it to `snapshot_url`
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_records' AND column_name='cloud_snapshot_url') THEN
    ALTER TABLE public.student_records RENAME COLUMN cloud_snapshot_url TO snapshot_url;
  END IF;
END $$;
