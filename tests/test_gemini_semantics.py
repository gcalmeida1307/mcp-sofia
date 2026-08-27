from server import parse_gemini_semantics


def test_parse_gemini_json_and_limit_lists():
    payload = parse_gemini_semantics(
        '```json\n{"summary":"Resumo","keywords":["rede","rede"],'
        '"concepts":["monitoramento"],"questions":["Como medir?"],'
        '"relationships":[{"source":"rede","relation":"usa","target":"monitoramento"}]}\n```'
    )
    assert payload is not None
    assert payload["summary"] == "Resumo"
    assert payload["keywords"] == ["rede"]
    assert payload["relationships"][0]["target"] == "monitoramento"


def test_parse_gemini_rejects_non_json():
    assert parse_gemini_semantics("não é json") is None
