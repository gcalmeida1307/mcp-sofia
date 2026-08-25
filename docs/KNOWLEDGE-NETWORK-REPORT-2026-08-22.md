# Relatório — Biblioteca semântica por módulo

## Resultado

| Item | Estado inicial | Alteração | Evidência | Teste | Resultado |
|---|---|---|---|---|---|
| Rede | Nuvem lexical com conexões artificiais | Grafo de embeddings persistidos e similaridade de cosseno | `server.py`, `/knowledge/semantic-graph` | 856 vetores, 30 nós, 7 arestas em Infraestrutura | Aprovado para o módulo processado |
| Isolamento | Filtro existia na recuperação, mas o mapa era genérico | Consultas do grafo exigem módulo e permissão no backend | `WHERE s.module_name=:module` + autorização | Endpoint sem sessão retorna 401; snapshot por módulo | Aprovado |
| Ruído | Menus, URLs e identificadores viravam assuntos | Filtro multilíngue e remoção de domínios, caminhos e termos de interface | `semantic_terms`, `GRAPH_NOISE_TERMS` | Regressão dos termos `read`, `view`, `login`, `facebook`, `search` | Aprovado |
| Fontes | Lista extensa misturada à visualização | Lista movida para “Gerenciar fontes” | `KnowledgeView` | Visualização principal não renderiza nomes/URLs/ações | Aprovado |
| Contagem | Indicadores genéricos | Tipo original, status e diferença total/prontas | `original_source_type` e `type_counts` | PDF permanece PDF; link permanece Link | Aprovado |
| Duplicidade | Links podiam ser repetidos | `source_key` normalizado e HTTP 409 | `ingest_url` | Mesmo link no mesmo módulo | Aprovado |
| Persistência | Vetores não eram utilizados na interface | Migração `012_semantic_graph.sql` para nós/arestas | Tabelas `ai_knowledge_nodes` e `ai_knowledge_edges` | Snapshot isolado de Infraestrutura | Aprovado |

## Causa dos assuntos incorretos

O método anterior aplicava contagem de palavras ao texto bruto das páginas e usava os termos mais frequentes para desenhar a rede. Como o texto continha menus, rodapés, botões, seletores de idioma e identificadores HTML, termos como `read`, `view`, `login` e `facebook` eram promovidos indevidamente a assuntos. As ligações do frontend eram geradas pela posição dos itens, sem similaridade calculada.

## Método implementado

Fontes do módulo → chunks persistidos → modelo local `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` → vetores normalizados de dimensão 384 → agrupamento por similaridade mínima de 0,72 → nomeação por termos com evidência documental → relações por similaridade dos centroides mínima de 0,70 → snapshot persistido por módulo.

Cada nó mantém quantidade de fontes, trechos, evidência, relevância e confiança. Cada aresta mantém peso, método e quantidade de evidências. Não há arestas criadas apenas para preencher a tela.

## Segurança e administração

O grafo exige sessão e permissão no módulo. A lista de fontes não é carregada na tela principal; a consulta administrativa exige `manage=1` e permissão de escrita. A biblioteca continua preservando as fontes originais e seus derivados, mas a visualização não expõe URLs, caminhos ou nomes de arquivo.

## Validações executadas

- `py_compile server.py scripts/build-semantic-graphs.py`: aprovado.
- `pytest -q`: 24 testes aprovados.
- `pnpm exec tsc --noEmit`: aprovado.
- `pnpm exec vite build`: aprovado.
- `pip check`: sem dependências quebradas.
- `/health`: HTTP 200.
- `/knowledge/semantic-graph` sem sessão: HTTP 401.
- Infraestrutura: 856 vetores, 30 nós, 7 arestas persistidas.

## Limitações e pendências

- A geração de embeddings é CPU-bound e deve ser executada em segundo plano para bibliotecas grandes.
- Só há rede disponível nos módulos que já possuem vetores. Os demais exibem explicitamente “Rede semântica ainda não calculada” até serem reprocessados.
- A limpeza profunda de HTML deve continuar sendo ampliada para páginas com conteúdo carregado exclusivamente por JavaScript; o crawler respeita `robots.txt`.
- A visualização atual possui SVG responsivo e navegação por teclado básica; zoom, pan e seleção detalhada de nó são próximos incrementos de UX.
- A qualidade jurídica, médica e operacional depende da pertinência e atualidade das fontes; o grafo não substitui validação profissional.
