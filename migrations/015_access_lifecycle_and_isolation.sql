-- Harden the first-access lifecycle without changing existing active users.
-- Existing sessions and module grants keep their current effective access.

ALTER TABLE access_requests
  DROP CONSTRAINT IF EXISTS access_requests_requested_module_check;
ALTER TABLE user_module_access
  DROP CONSTRAINT IF EXISTS user_module_access_module_name_check;
ALTER TABLE knowledge_sources
  DROP CONSTRAINT IF EXISTS knowledge_sources_module_name_check;

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'authenticated';
ALTER TABLE app_sessions
  DROP CONSTRAINT IF EXISTS app_sessions_purpose_check;
ALTER TABLE app_sessions
  ADD CONSTRAINT app_sessions_purpose_check
  CHECK (purpose IN ('authenticated', 'activation'));

ALTER TABLE user_module_access
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'active';
ALTER TABLE user_module_access
  DROP CONSTRAINT IF EXISTS user_module_access_status_check;
ALTER TABLE user_module_access
  ADD CONSTRAINT user_module_access_status_check
  CHECK (access_status IN ('pending_activation', 'active', 'revoked'));

ALTER TABLE user_totp
  ADD COLUMN IF NOT EXISTS last_used_step bigint;

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_one_pending_idx
  ON access_requests (lower(email::text), requested_module)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS app_sessions_active_purpose_idx
  ON app_sessions (user_id, purpose, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS user_module_access_active_idx
  ON user_module_access (user_id, module_name)
  WHERE access_status = 'active';
