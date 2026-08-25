-- Local governance, retention and human-approved evaluation datasets.
-- This migration is additive and does not remove existing records.
CREATE TABLE IF NOT EXISTS data_governance_policies (
  module_name text PRIMARY KEY,
  retention_days integer NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 1 AND 36500),
  sensitive_data_policy text NOT NULL DEFAULT 'minimize-and-audit',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  subject_reference text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export','deletion','access','correction')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  requested_by uuid,
  decided_by uuid,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS data_subject_requests_module_idx ON data_subject_requests(module_name, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  version_no integer NOT NULL,
  source_feedback_count integer NOT NULL DEFAULT 0,
  approved_by uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  content_sha256 char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_name, version_no)
);

CREATE TABLE IF NOT EXISTS ai_model_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  dataset_version_id uuid REFERENCES ai_dataset_versions(id) ON DELETE SET NULL,
  model_name text NOT NULL,
  score_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Application-role grants are applied by setup-postgres-local.ps1.
