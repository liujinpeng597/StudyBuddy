CREATE TABLE knowledge_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES knowledge_modules(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'module',
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, parent_id, name)
);

CREATE TABLE knowledge_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES knowledge_modules(id) ON DELETE SET NULL,
  canonical_title text NOT NULL,
  summary text NOT NULL,
  sections jsonb NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  embedding jsonb,
  review_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX knowledge_nodes_title_idx ON knowledge_nodes(user_id, lower(canonical_title));
CREATE INDEX knowledge_nodes_module_idx ON knowledge_nodes(user_id, module_id);
CREATE INDEX knowledge_nodes_title_trgm_idx ON knowledge_nodes USING gin (lower(canonical_title) gin_trgm_ops);

CREATE TABLE knowledge_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  type text NOT NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0.700,
  origin text NOT NULL DEFAULT 'ai',
  review_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_id <> target_id)
);

CREATE UNIQUE INDEX knowledge_relations_unique_idx ON knowledge_relations(user_id, source_id, target_id, type);
CREATE INDEX knowledge_relations_source_idx ON knowledge_relations(source_id);
CREATE INDEX knowledge_relations_target_idx ON knowledge_relations(target_id);

CREATE TABLE source_node_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_asset_id uuid NOT NULL REFERENCES source_assets(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  source_excerpt text NOT NULL,
  question_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_asset_id, node_id, source_excerpt)
);

CREATE TABLE knowledge_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  node_id uuid REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_revisions_job_idx ON knowledge_revisions(job_id);

CREATE TABLE graph_layout (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  x double precision NOT NULL,
  y double precision NOT NULL,
  cluster_key text,
  PRIMARY KEY (user_id, node_id)
);
