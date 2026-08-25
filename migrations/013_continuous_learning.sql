-- Continuous learning orchestration. This stores jobs, approved prompt
-- guidance and auditable state; it never changes model weights automatically.
CREATE TABLE IF NOT EXISTS ai_learning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('filesystem_scan','database_sync','link_refresh','semantic_graph','dataset_prepare','evaluation')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  -- UUID correlation only; the application role intentionally cannot add
  -- REFERENCES privileges to the security-owned authentication tables.
  requested_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_learning_jobs_module_idx ON ai_learning_jobs(module_name, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  version_no integer NOT NULL,
  prompt_text text NOT NULL,
  source_feedback_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_name, version_no)
);
CREATE INDEX IF NOT EXISTS ai_prompt_versions_active_idx ON ai_prompt_versions(module_name, status, version_no DESC);

CREATE TABLE IF NOT EXISTS ai_learning_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_learning_audit_module_idx ON ai_learning_audit(module_name, created_at DESC);
