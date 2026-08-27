from intelligence_orchestrator import plan_query
from server import (ask_claude_with_context, clean_retrieved_text, expanded_question,
                    html_to_text, module_info, rag_only_answer, retrieval_quality_gate,
                    semantic_split_chunks)


def test_html_extraction_removes_navigation_and_deduplicates():
    raw = b"<header>Menu</header><main><h1>COVID-19</h1><p>Febre e tosse.</p><p>Febre e tosse.</p></main><footer>Contato</footer>"
    text = html_to_text(raw)
    assert "Menu" not in text
    assert "Contato" not in text
    assert text.count("Febre e tosse.") == 1


def test_web_boilerplate_is_rejected_across_modules():
    noisy = "Pagina inicial Home Collections Select language Português English Español"
    assert clean_retrieved_text(noisy) == ""


def test_semantic_chunks_are_bounded_and_unique():
    chunks = semantic_split_chunks("## Sintomas\nFebre e tosse.\n\n## Tratamento\nRepouso e hidratação.")
    assert len(chunks) == 2
    assert all(len(chunk) < 1800 for chunk in chunks)


def test_orchestrator_escalates_high_risk_after_local_answer():
    plan = plan_query("medicina", "Quais sintomas exigem atendimento urgente?")
    assert plan.stream_local is True
    assert plan.verify_after is True
    assert plan.risk == "high"


def test_claude_fallback_does_not_run_without_configured_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert ask_claude_with_context("medicina", "pergunta", "evidência") is None


def test_existing_navigation_chunk_is_rejected_and_legal_module_is_broad():
    noisy = "TST Ir para o conteúdo principal Barra Topo Menu Navegação Social e Acessibilidade Latest news"
    assert clean_retrieved_text(noisy) == ""
    assert module_info("juridico-trabalhista")["title"] == "Direito"


def test_legal_question_expands_weekly_rest_concepts():
    expanded = expanded_question("juridico-trabalhista", "O que acontece se eu trabalhar 7 dias consecutivos?")
    assert "descanso semanal remunerado" in expanded
    assert "Lei 605/49" in expanded


def test_quality_gate_rejects_cover_and_accepts_relevant_legal_chunk():
    rows = retrieval_quality_gate(
        "O que acontece se eu trabalhar 7 dias consecutivos?",
        [
            {"chunk_text": "Senado Federal Mesa Biênio expediente Vade Mecum"},
            {"chunk_text": "O repouso semanal remunerado deve observar 24 horas consecutivas e a folga semanal."},
        ],
    )
    assert len(rows) == 1
    assert "repouso semanal" in rows[0]["chunk_text"]


def test_rag_fallback_never_uses_first_chunk_as_answer():
    answer = rag_only_answer("juridico-trabalhista", "trabalhar 7 dias consecutivos", "[Fonte: vade.txt]\nSenado Federal Mesa Biênio")
    assert "Senado Federal" not in answer
    assert "filtro de relevancia" in answer
