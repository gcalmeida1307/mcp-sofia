"""Compare the Infrastructure knowledge library with the 20-item training list."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
import server


TARGETS = [
    (1, "Liderança de equipes", ("liderança de equipes",)),
    (2, "Governança de TI", ("governança de tic para o governo digital",)),
    (3, "Gestão de serviços de TI", ("gerenciamento de serviços de tic",)),
    (4, "Gestão de projetos", ("gerenciamento de projetos na prática",)),
    (5, "Projetos ágeis e inovação", ("inovando na gestão de projetos",)),
    (6, "Análise de requisitos e negócios", ("análise de negócios no desenvolvimento de soluções",)),
    (7, "Contratação de tecnologia", ("planejamento da contratação de soluções de tic",)),
    (8, "Fiscalização de contratos de TI", ("fiscalizando contratações de tecnologia",)),
    (9, "Segurança da informação", ("fundamentos de segurança da informação",)),
    (10, "Riscos de aplicações web", ("owasp top 10 2025",)),
    (11, "Gestão de riscos cibernéticos", ("nist cybersecurity framework",)),
    (12, "LGPD", ("como implementar a lgpd",)),
    (13, "Indicadores de desempenho", ("indicadores de desempenho para a transformação digital",)),
    (14, "Análise de dados", ("análise de dados como suporte à tomada de decisão",)),
    (15, "Dashboards e BI", ("power bi para aprimoramento da gestão",)),
    (16, "Automação de processos", ("automação de processos com rpa",)),
    (17, "Confiabilidade e operação", ("google site reliability engineering",)),
    (18, "IA generativa", ("introdução à ia generativa e aos agentes",)),
    (19, "Uso profissional de IA", ("openai academy",)),
    (20, "Governança de IA", ("nist ai risk management framework",)),
]


def main() -> None:
    engine = server.database_engine()
    if engine is None:
        raise SystemExit("DATABASE_URL não configurada.")
    with engine.connect() as connection:
        rows = connection.execute(text("""SELECT original_name, source_url, storage_path, processing_status
            FROM knowledge_sources
            WHERE module_name='infraestrutura' AND bucket='links' AND is_current AND deleted_at IS NULL
            ORDER BY created_at""")).mappings().all()
    haystack = []
    for row in rows:
        content = ""
        try:
            content = Path(str(row["storage_path"])).read_text(encoding="utf-8", errors="ignore")[:200000]
        except OSError:
            pass
        haystack.append(f"{row['original_name']} {row['source_url']} {content}".casefold())
    print(f"INFRA_LINKS_CADASTRADOS={len(rows)}")
    matched = 0
    for number, title, terms in TARGETS:
        found = [rows[index] for index, value in enumerate(haystack) if any(term.casefold() in value for term in terms)]
        if found:
            matched += 1
            print(f"{number:02d} [OK] {title} -> {found[0]['source_url']} ({found[0]['processing_status']})")
        else:
            print(f"{number:02d} [AUSENTE] {title}")
    print(f"TEMAS_ENCONTRADOS={matched}/20")


if __name__ == "__main__":
    main()
