CREATE TABLE knowledge_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_asset_id uuid NOT NULL REFERENCES source_assets(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'knowledge',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  validation_errors jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_candidates_job_idx ON knowledge_candidates(job_id);
