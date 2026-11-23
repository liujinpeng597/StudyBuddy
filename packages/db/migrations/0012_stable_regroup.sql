ALTER TABLE knowledge_nodes
  ADD COLUMN IF NOT EXISTS study_order integer NOT NULL DEFAULT 500;

CREATE INDEX IF NOT EXISTS knowledge_nodes_study_order_idx
  ON knowledge_nodes(user_id, module_id, study_order);

CREATE TABLE IF NOT EXISTS knowledge_regroup_runs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signature text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, signature)
);
