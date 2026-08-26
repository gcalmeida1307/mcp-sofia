"""Fast regression tests for storage isolation and deterministic processing helpers."""

from pathlib import Path

from server import GESTAO_IA_GUIDANCE, MODULE_FOLDERS, core_managerial_overview, expanded_question, knowledge_scan_roots, module_knowledge, route_question, safe_filename, safe_module_slug, safe_remote_url, split_chunks


def test_slug_and_filename_never_escape_storage():
    assert safe_module_slug("Financeiro / 2026") == "financeiro-2026"
    assert safe_filename("../../segredo.pdf") == "segredo.pdf"
    assert ".." not in Path(safe_filename("..\\..\\segredo.pdf")).parts


def test_chunking_is_bounded_and_overlapping():
    chunks = split_chunks("A" * 5000, size=1000, overlap=100)
    assert len(chunks) >= 5
    assert all(len(chunk) <= 1000 for chunk in chunks)
    assert chunks[0][-100:] == chunks[1][:100]


def test_standard_module_folders_are_declared():
    assert {"textos", "imagens", "links"}.issubset(set(MODULE_FOLDERS))
    assert "processados" in MODULE_FOLDERS


def test_local_reindex_uses_configured_knowledge_root(tmp_path, monkeypatch):
    knowledge_root = tmp_path / "knowledge"
    (knowledge_root / "gestao-empresarial").mkdir(parents=True)
    monkeypatch.setattr("server.KNOWLEDGE_BASE_PATH", knowledge_root)
    roots = knowledge_scan_roots("gestao-empresarial")
    assert roots
    assert roots[0].name == "gestao-empresarial"
    assert roots[0].parent.name == "knowledge"


def test_gestao_6d_retrieves_the_local_study(tmp_path, monkeypatch):
    knowledge_root = tmp_path / "knowledge"
    module_root = knowledge_root / "gestao-empresarial"
    module_root.mkdir(parents=True)
    (module_root / "IAGESTAOUNIVERSITARIA.txt").write_text("Modelo 6D para gestão universitária", encoding="utf-8")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr("server.KNOWLEDGE_BASE_PATH", knowledge_root)
    evidence = module_knowledge("gestao-empresarial", "Me diga algo sobre o modelo 6D")
    assert "IAGESTAOUNIVERSITARIA.txt" in evidence
    assert "Modelo 6D" in evidence


def test_medical_query_expands_related_terms_without_crossing_modules():
    expanded = expanded_question("medicina", "causas comuns de coriza")
    assert "rinorreia" in expanded
    assert "nariz escorrendo" in expanded
    assert expanded_question("infraestrutura", "coriza") == "coriza"


def test_module_semantics_expand_without_crossing_domains():
    assert "kpi" in expanded_question("gestao-empresarial", "quero analisar um indicador")
    assert "trigger" in expanded_question("infraestrutura", "como configurar um alerta no zabbix")
    assert "subordinação" in expanded_question("juridico-trabalhista", "há vínculo de emprego?")
    assert "kpi" not in expanded_question("medicina", "quero analisar um indicador")


def test_gestao_ia_guidance_requires_evidence_before_expansion():
    assert "identidade institucional" in GESTAO_IA_GUIDANCE
    assert "projeto-piloto" in GESTAO_IA_GUIDANCE
    assert '"Concluído com evidência"' in GESTAO_IA_GUIDANCE
    assert "Não invente linhas de base" in GESTAO_IA_GUIDANCE


def test_informatica_uses_infraestrutura_knowledge_namespace():
    from server import MODULES, canonical_module_name, connection_error_message
    assert "infraestrutura" in MODULES
    assert "informatica" not in MODULES
    assert canonical_module_name("Informática") == "infraestrutura"
    assert canonical_module_name("infra") == "infraestrutura"
    assert "rede" in expanded_question("infraestrutura", "analisar a rede")
    assert connection_error_message(RuntimeError("connection refused"))[0] == "HOST_UNREACHABLE"
    assert connection_error_message(RuntimeError("password authentication failed"))[0] == "AUTHENTICATION_FAILED"


def test_remote_url_rejects_private_hosts_and_control_characters():
    assert not safe_remote_url("http://127.0.0.1/manual")
    assert not safe_remote_url("https://example.org/arquivo com espaco.pdf")


def test_labor_routes_cover_common_questions(monkeypatch):
    monkeypatch.setattr("server.active_module_names", lambda: ["core", "juridico-trabalhista"])
    for question in (
        "Atestado superior a 15 dias, como proceder?",
        "desvio de função",
        "férias trabalhistas",
        "Quais são os requisitos para caracterizar vínculo de emprego?",
    ):
        assert route_question(question)[0] == "juridico-trabalhista"


def test_labor_article_search_prioritizes_context_over_duplicate_article_numbers(tmp_path, monkeypatch):
    knowledge_root = tmp_path / "knowledge"
    module_root = knowledge_root / "juridico-trabalhista"
    module_root.mkdir(parents=True)
    (module_root / "CLT.txt").write_text("Cabe recurso ordinário no prazo de 8 (oito) dias.", encoding="utf-8")
    monkeypatch.setattr("server.KNOWLEDGE_BASE_PATH", knowledge_root)
    evidence = module_knowledge("juridico-trabalhista", "qual prazo para recurso no direito do trabalho?")
    assert "Cabe recurso" in evidence
    assert "8 (oito) dias" in evidence


def test_core_managerial_view_is_aggregated_and_module_scoped(monkeypatch):
    monkeypatch.setattr("server.active_module_names", lambda: ["core", "medicina", "infraestrutura"])
    monkeypatch.setattr("server.module_info", lambda name: {"title": name.title()})
    monkeypatch.setattr("server.numeric_trends", lambda name: {"records_analyzed": 4, "metrics": [{"field": "valor"}], "dimensions": [], "topic_matches": [], "insights": [{"message": f"insight-{name}"}]})
    overview = core_managerial_overview()
    assert {item["module"] for item in overview["modules"]} == {"medicina", "infraestrutura"}
    assert all("raw" not in item for item in overview["modules"])
    assert len(overview["insights"]) == 2
