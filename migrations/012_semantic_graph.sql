-- Persistent, module-scoped semantic graph derived only from persisted embeddings.
CREATE TABLE IF NOT EXISTS ai_knowledge_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  node_key text NOT NULL,
  label text NOT NULL,
  summary text NOT NULL DEFAULT '',
  source_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  relevance numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  model_name text NOT NULL,
  embedding_dimension integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_name, node_key)
);
CREATE INDEX IF NOT EXISTS ai_knowledge_nodes_module_idx ON ai_knowledge_nodes(module_name, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_knowledge_edges (
  module_name text NOT NULL,
  source_node_id uuid NOT NULL REFERENCES ai_knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES ai_knowledge_nodes(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'semantic_similarity',
  weight numeric NOT NULL,
  evidence_count integer NOT NULL DEFAULT 0,
  method text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(module_name, source_node_id, target_node_id)
);
CREATE INDEX IF NOT EXISTS ai_knowledge_edges_module_idx ON ai_knowledge_edges(module_name, updated_at DESC);
