from intelligence_orchestrator import plan_query
from server import html_to_text, semantic_split_chunks


def test_html_extraction_removes_navigation_and_deduplicates():
    raw = b"<header>Menu</header><main><h1>COVID-19</h1><p>Febre e tosse.</p><p>Febre e tosse.</p></main><footer>Contato</footer>"
    text = html_to_text(raw)
    assert "Menu" not in text
    assert "Contato" not in text
    assert text.count("Febre e tosse.") == 1


def test_semantic_chunks_are_bounded_and_unique():
    chunks = semantic_split_chunks("## Sintomas\nFebre e tosse.\n\n## Tratamento\nRepouso e hidratação.")
    assert len(chunks) == 2
    assert all(len(chunk) < 1800 for chunk in chunks)


def test_orchestrator_escalates_high_risk_after_local_answer():
    plan = plan_query("medicina", "Quais sintomas exigem atendimento urgente?")
    assert plan.stream_local is True
    assert plan.verify_after is True
    assert plan.risk == "high"
