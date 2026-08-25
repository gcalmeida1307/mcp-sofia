-- Management module: receives aggregated indicators, not raw cross-module data.
INSERT INTO knowledge_modules(slug, display_name, description)
VALUES ('gestao-empresarial', 'Gestão Empresarial', 'Indicadores, processos, custos, eficiência operacional e apoio gerencial entre módulos.')
ON CONFLICT(slug) DO UPDATE SET display_name=EXCLUDED.display_name, description=EXCLUDED.description, is_active=true, updated_at=now();

INSERT INTO module_visual_config(module_slug, accent_hex, icon)
VALUES ('gestao-empresarial', '#3949AB', '◉')
ON CONFLICT(module_slug) DO NOTHING;
