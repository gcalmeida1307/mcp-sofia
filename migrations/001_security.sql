CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email citext NOT NULL UNIQUE,
    password_hash text NOT NULL,
    display_name text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT 'module_user' CHECK (role IN ('global', 'module_user')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
    approved_by uuid,
    approved_at timestamptz,
    must_change_password boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_totp (
    user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    secret_ciphertext bytea NOT NULL,
    enabled_at timestamptz,
    recovery_codes_hashes text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS user_module_access (
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    module_name text NOT NULL CHECK (module_name IN ('infraestrutura', 'medicina', 'almoxarifado')),
    approved_by uuid REFERENCES app_users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, module_name)
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'module_user';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth_audit (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    ip_hash char(64),
    user_agent_hash char(64),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name text NOT NULL CHECK (module_name IN ('infraestrutura', 'medicina', 'almoxarifado')),
    bucket text NOT NULL CHECK (bucket IN ('textos', 'bases_de_dados', 'imagens', 'links')),
    original_name text NOT NULL,
    storage_path text NOT NULL,
    source_url text,
    mime_type text NOT NULL,
    sha256 char(64) NOT NULL,
    content bytea,
    extracted_text text,
    schema_json jsonb,
    source_key text NOT NULL DEFAULT '',
    version_no integer NOT NULL DEFAULT 1 CHECK (version_no > 0),
    is_current boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS content bytea;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS extracted_text text;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS schema_json jsonb;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS source_key text NOT NULL DEFAULT '';
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS version_no integer NOT NULL DEFAULT 1;
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
