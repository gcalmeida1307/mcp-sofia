-- Explicit semantic layer for approved metrics and read-only views.
-- The application validates SQL as a second line of defense; these tables
-- define what the model is allowed to ask for in the first place.
CREATE TABLE IF NOT EXISTS semantic_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  view_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  allowed_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_filter text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_name, view_name)
);

CREATE TABLE IF NOT EXISTS semantic_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  metric_key text NOT NULL,
  description text NOT NULL,
  view_name text NOT NULL,
  definition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_name, metric_key)
);

CREATE INDEX IF NOT EXISTS semantic_views_module_idx ON semantic_views(module_name, is_active);
CREATE INDEX IF NOT EXISTS semantic_metrics_module_idx ON semantic_metrics(module_name, is_active);
