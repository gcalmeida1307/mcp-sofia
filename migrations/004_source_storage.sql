-- Keep large originals on the configured server filesystem while the database
-- stores metadata, extracted text and searchable chunks.
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS storage_mode text NOT NULL DEFAULT 'inline';
ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_storage_mode_check;
ALTER TABLE knowledge_sources ADD CONSTRAINT knowledge_sources_storage_mode_check
  CHECK (storage_mode IN ('inline','filesystem'));
CREATE INDEX IF NOT EXISTS knowledge_sources_storage_mode_idx ON knowledge_sources(storage_mode);
