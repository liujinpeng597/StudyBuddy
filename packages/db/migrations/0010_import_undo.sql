CREATE INDEX import_jobs_recovery_idx ON import_jobs(user_id, status, undo_status);
CREATE INDEX knowledge_revisions_node_job_idx ON knowledge_revisions(node_id, job_id);

CREATE TABLE account_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  remaining_prefixes jsonb NOT NULL DEFAULT '[]',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
