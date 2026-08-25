-- Visual identity for modules and stable human-friendly login identifiers.
CREATE TABLE IF NOT EXISTS module_visual_config (
    module_slug text PRIMARY KEY,
    accent_hex text NOT NULL DEFAULT '#1565C0' CHECK (accent_hex ~ '^#[0-9A-Fa-f]{6}$'),
    icon text NOT NULL DEFAULT '◆' CHECK (char_length(icon) BETWEEN 1 AND 4),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_identifiers (
    identifier text PRIMARY KEY CHECK (identifier ~ '^(AG|AM|OP)[0-9]{6}$'),
    user_id uuid NOT NULL UNIQUE,
    role_code text NOT NULL CHECK (role_code IN ('AG','AM','OP')),
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO module_visual_config(module_slug, accent_hex, icon)
VALUES
 ('infraestrutura','#1565C0','◈'), ('medicina','#2E7D32','✦'), ('almoxarifado','#EF6C00','◉'),
 ('recursos-humanos','#E05D44','●'), ('contabilidade','#546E7A','▣'), ('financeiro','#B8860B','¤'),
 ('juridico-trabalhista','#7B1E3A','§'), ('secretaria','#00838F','◇'), ('cursos','#6F42C1','✦'),
 ('biblioteca','#795548','▤'), ('pesquisa-extensao','#C2185B','✺'), ('compras','#EF6C00','◆')
ON CONFLICT(module_slug) DO NOTHING;

-- The application role is intentionally not the database owner.
-- Application-role grants are applied by setup-postgres-local.ps1.

-- Backfill identifiers for installations that already had users before this migration.
WITH role_map AS (
    SELECT u.id, u.created_at,
           CASE WHEN u.role='global' THEN 'AG'
                WHEN EXISTS (SELECT 1 FROM user_module_access a WHERE a.user_id=u.id AND a.module_role='manager') THEN 'AM'
                ELSE 'OP' END AS role_code
    FROM app_users u
    WHERE NOT EXISTS (SELECT 1 FROM user_identifiers i WHERE i.user_id=u.id)
), numbered AS (
    SELECT id, role_code, ROW_NUMBER() OVER (PARTITION BY role_code ORDER BY created_at, id) AS seq
    FROM role_map
)
INSERT INTO user_identifiers(identifier,user_id,role_code)
SELECT role_code || LPAD(seq::text, 6, '0'), id, role_code FROM numbered
ON CONFLICT DO NOTHING;
