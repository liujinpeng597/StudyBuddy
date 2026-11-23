CREATE TABLE ai_model_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'openai-compatible',
  base_url text NOT NULL,
  model_id text NOT NULL,
  api_key_ciphertext bytea NOT NULL,
  api_key_hint text NOT NULL,
  capabilities text[] NOT NULL DEFAULT '{}',
  requested_roles text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'untested',
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, display_name)
);

CREATE TABLE ai_task_routes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_role text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  profile_id uuid NOT NULL REFERENCES ai_model_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, task_role, position)
);

CREATE INDEX ai_task_routes_profile_idx ON ai_task_routes(profile_id);

CREATE TABLE ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid,
  profile_id uuid REFERENCES ai_model_profiles(id) ON DELETE SET NULL,
  task_role text NOT NULL,
  model_id text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_usage_user_day_idx ON ai_usage_logs(user_id, created_at);
