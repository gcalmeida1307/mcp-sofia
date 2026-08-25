-- Access requests, auditable module-scoped roles, and recoverable knowledge imports.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_status_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_status_check CHECK (status IN ('pending','active','rejected','blocked','inactive'));
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email citext NOT NULL,
  requested_module text NOT NULL CHECK (requested_module IN ('infraestrutura','medicina','almoxarifado')),
  justification text NOT NULL DEFAULT '',
  accepted_terms boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','blocked','inactive')),
  decided_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests(status, created_at DESC);

ALTER TABLE user_module_access ADD COLUMN IF NOT EXISTS module_role text NOT NULL DEFAULT 'operator';
ALTER TABLE user_module_access DROP CONSTRAINT IF EXISTS user_module_access_module_role_check;
ALTER TABLE user_module_access ADD CONSTRAINT user_module_access_module_role_check CHECK (module_role IN ('operator','manager','global'));

ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processed';
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS processing_error text;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS size_bytes bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  rating smallint CHECK (rating IN (-1,1)),
  approved_for_dataset boolean NOT NULL DEFAULT false,
  model_name text NOT NULL DEFAULT 'claude',
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  name text NOT NULL,
  dialect text NOT NULL,
  config_ciphertext bytea NOT NULL,
  is_read_only boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  name text NOT NULL,
  definition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_records (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  row_no integer NOT NULL,
  data_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, row_no)
);
