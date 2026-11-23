CREATE TABLE import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  progress integer NOT NULL DEFAULT 0,
  study_date date NOT NULL DEFAULT CURRENT_DATE,
  error_code text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  lock_token text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  summary jsonb,
  question_status text NOT NULL DEFAULT 'pending',
  undo_status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX import_jobs_user_idx ON import_jobs(user_id, created_at DESC);
CREATE INDEX import_jobs_queue_idx ON import_jobs(status, created_at);

CREATE TABLE source_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  type text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  checksum text NOT NULL,
  byte_size bigint NOT NULL,
  extracted_text text,
  study_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'uploaded',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_job_id, checksum)
);

CREATE INDEX source_assets_job_idx ON source_assets(import_job_id);
CREATE INDEX source_assets_user_idx ON source_assets(user_id);
