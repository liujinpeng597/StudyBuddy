CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  type text NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  answer_key jsonb,
  correct_indexes integer[] NOT NULL DEFAULT '{}',
  explanation text NOT NULL,
  rubric jsonb NOT NULL DEFAULT '[]',
  source_node_ids uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX questions_user_job_idx ON questions(user_id, import_job_id, created_at);

CREATE TABLE attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer jsonb NOT NULL,
  score numeric(4,2),
  feedback jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attempts_question_idx ON attempts(question_id, created_at DESC);
