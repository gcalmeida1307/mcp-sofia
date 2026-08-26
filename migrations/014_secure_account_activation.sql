-- One-time activation for approved users. Kept separate from app_users so the
-- runtime database role does not need ALTER ownership over authentication data.
CREATE TABLE IF NOT EXISTS account_activation_tokens (
  user_id uuid PRIMARY KEY,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_activation_tokens_pending_idx
  ON account_activation_tokens (token_hash)
  WHERE used_at IS NULL;
