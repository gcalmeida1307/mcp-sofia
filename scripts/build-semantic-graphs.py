import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server

engine = server.database_engine()
for module in ("infraestrutura", "medicina", "gestao-empresarial", "juridico-trabalhista"):
    with engine.connect() as connection:
        graph = server.build_semantic_graph(connection, module)
    server.persist_semantic_graph(engine, graph)
    print(module, graph.get("available"), len(graph.get("nodes", [])), len(graph.get("edges", [])))
engine.dispose()
