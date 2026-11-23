CREATE INDEX users_lower_email_idx ON users(lower(email));
CREATE INDEX ai_model_profiles_user_idx ON ai_model_profiles(user_id);
CREATE INDEX graph_layout_user_idx ON graph_layout(user_id);

-- The single deployment uses application-level user filters plus transaction context.
-- Policies are added without FORCE so the bootstrap auth connection can still sign in.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_node_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leetcode_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_user_policy ON sessions
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY model_profiles_user_policy ON ai_model_profiles
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY task_routes_user_policy ON ai_task_routes
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY import_jobs_user_policy ON import_jobs
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY source_assets_user_policy ON source_assets
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY knowledge_nodes_user_policy ON knowledge_nodes
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY knowledge_relations_user_policy ON knowledge_relations
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY source_node_links_user_policy ON source_node_links
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY knowledge_revisions_user_policy ON knowledge_revisions
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY search_documents_user_policy ON search_documents
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY questions_user_policy ON questions
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY attempts_user_policy ON attempts
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY leetcode_problems_user_policy ON leetcode_problems
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));
