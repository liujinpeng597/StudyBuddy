CREATE TABLE leetcode_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_asset_id uuid NOT NULL REFERENCES source_assets(id) ON DELETE CASCADE,
  title text,
  number integer,
  description text,
  language text,
  code text,
  data_structures text[] NOT NULL DEFAULT '{}',
  algorithms text[] NOT NULL DEFAULT '{}',
  complexity jsonb NOT NULL DEFAULT '{}',
  optimization_notes text,
  inferred_fields text[] NOT NULL DEFAULT '{}',
  incomplete_fields text[] NOT NULL DEFAULT '{}',
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE problem_node_links (
  problem_id uuid NOT NULL REFERENCES leetcode_problems(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'applies_to',
  PRIMARY KEY (problem_id, node_id, relation_type)
);

CREATE INDEX leetcode_problems_user_idx ON leetcode_problems(user_id, created_at DESC);
