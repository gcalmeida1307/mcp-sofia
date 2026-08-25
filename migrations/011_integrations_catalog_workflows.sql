-- Integration catalog and workflow metadata. Existing external_connections and
-- dashboards remain the canonical persisted entities; these columns add the
-- lifecycle needed by the user-facing source catalog.
ALTER TABLE external_connections ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'database';
ALTER TABLE external_connections ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'em_configuracao';
ALTER TABLE external_connections ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'all';
ALTER TABLE external_connections ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;
ALTER TABLE external_connections ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE external_connections ADD COLUMN IF NOT EXISTS discovery_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE external_connections DROP CONSTRAINT IF EXISTS external_connections_source_type_check;
ALTER TABLE external_connections ADD CONSTRAINT external_connections_source_type_check
  CHECK (source_type IN ('database','file','api','zabbix','totvs','fluig'));
ALTER TABLE external_connections DROP CONSTRAINT IF EXISTS external_connections_status_check;
ALTER TABLE external_connections ADD CONSTRAINT external_connections_status_check
  CHECK (status IN ('em_configuracao','testando','conectada','disponivel','sincronizando','com_erro','pausada','credencial_expirada'));
CREATE INDEX IF NOT EXISTS external_connections_catalog_idx ON external_connections(module_name, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','error')),
  definition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running','success','failed','cancelled')),
  detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS workflows_module_idx ON workflows(module_name, updated_at DESC);
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx ON workflow_runs(workflow_id, started_at DESC);