-- Conversational memory and auditable trend snapshots.
CREATE TABLE IF NOT EXISTS ai_query_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sources_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_mode text NOT NULL DEFAULT 'indexed',
  external_research boolean NOT NULL DEFAULT false,
  model_name text NOT NULL DEFAULT 'claude',
  -- The service role cannot reference the security-owned app_users table on
  -- installations created by the hardened bootstrap. The UUID is still kept
  -- for audit correlation and is validated at the API boundary.
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_query_history_module_date_idx ON ai_query_history(module_name, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_query_history_question_idx ON ai_query_history(module_name, lower(question));

CREATE TABLE IF NOT EXISTS ai_trend_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  metric_name text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_trend_snapshots_module_idx ON ai_trend_snapshots(module_name, created_at DESC);

-- Application-role grants are applied by setup-postgres-local.ps1.
