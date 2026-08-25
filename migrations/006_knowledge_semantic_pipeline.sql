-- Semantic retrieval metadata. JSON storage keeps the first local deployment
-- compatible even when the PostgreSQL vector extension is unavailable.
CREATE TABLE IF NOT EXISTS ai_semantic_chunks (
  source_id uuid NOT NULL,
  chunk_no integer NOT NULL,
  embedding_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_id, chunk_no)
);
CREATE INDEX IF NOT EXISTS ai_semantic_chunks_source_idx ON ai_semantic_chunks(source_id);

CREATE TABLE IF NOT EXISTS ai_retrieval_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  question text NOT NULL,
  expanded_query text NOT NULL,
  candidates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  retrieved_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  discarded_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_chars integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_retrieval_diagnostics_module_idx ON ai_retrieval_diagnostics(module_name, created_at DESC);

-- Application-role grants are applied by setup-postgres-local.ps1.
