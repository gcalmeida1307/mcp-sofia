-- Generic module registry and source pipeline metadata.
CREATE TABLE IF NOT EXISTS knowledge_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

INSERT INTO knowledge_modules(slug,display_name,description)
VALUES
  ('infraestrutura','Infraestrutura','Informática, redes, sistemas, hardware, software e suporte técnico.'),
  ('medicina','Medicina','Medicina e prontuário eletrônico.'),
  ('almoxarifado','Almoxarifado','Estoque, materiais, requisições, entradas, saídas e inventário.')
ON CONFLICT(slug) DO NOTHING;

ALTER TABLE user_module_access DROP CONSTRAINT IF EXISTS user_module_access_module_name_check;
ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_module_name_check;
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_requested_module_check;
ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_bucket_check;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS last_processed_at timestamptz;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS source_chunks (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  chunk_no integer NOT NULL,
  page_no integer,
  section_name text,
  chunk_text text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, chunk_no)
);
CREATE INDEX IF NOT EXISTS source_chunks_source_idx ON source_chunks(source_id);
CREATE INDEX IF NOT EXISTS source_chunks_text_idx ON source_chunks USING gin(to_tsvector('simple', chunk_text));

CREATE TABLE IF NOT EXISTS source_processing_logs (
  id bigserial PRIMARY KEY,
  source_id uuid REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text NOT NULL DEFAULT '',
  technical_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Application-role grants are applied by setup-postgres-local.ps1 after all
-- migrations, because the role name is generated per installation.
