CREATE TABLE search_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  node_id uuid REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  source_id uuid REFERENCES source_assets(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  UNIQUE (user_id, document_type, node_id, source_id)
);

CREATE INDEX search_documents_title_trgm_idx ON search_documents USING gin (lower(title) gin_trgm_ops);
CREATE INDEX search_documents_body_trgm_idx ON search_documents USING gin (lower(body) gin_trgm_ops);
CREATE INDEX search_documents_user_idx ON search_documents(user_id);
