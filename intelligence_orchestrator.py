"""Cheap, deterministic planning for the SOFIA critical path."""
from dataclasses import dataclass


@dataclass(frozen=True)
class QueryPlan:
    module: str
    risk: str
    use_cache: bool = True
    use_memory: bool = True
    retrieve: bool = True
    stream_local: bool = True
    verify_after: bool = False


def plan_query(module: str, question: str, *, write: bool = False) -> QueryPlan:
    value = question.casefold()
    risk = "normal"
    if write or any(term in value for term in ("criar", "alterar", "excluir", "aprovar", "enviar")):
        risk = "critical"
    elif any(term in value for term in ("medic", "diagnóst", "diagnost", "juríd", "jurid", "contrato", "finance", "pagamento", "urgente", "urgência", "atendimento imediato")):
        risk = "high"
    return QueryPlan(module=module, risk=risk, verify_after=risk in {"high", "critical"})
