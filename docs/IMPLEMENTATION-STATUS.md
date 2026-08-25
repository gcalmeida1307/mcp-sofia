# SOFIA — status de implementação dos itens 4–12 e pipeline de conhecimento

## Entregue e validado

- Item 4: solicitação pública com nome, sobrenome, e-mail, módulo e justificativa; aprovação Global; escolha de Operador, Gestor ou Global; senha temporária; TOTP criado após aprovação.
- Item 5: upload organizado por módulo/tipo; links; arquivos de texto, PDF, DOCX, TXT, imagens, CSV/TSV/XLSX; CSV/TSV/XLSX materializados em `knowledge_records` com limites; reindexação das pastas locais via `/knowledge/reindex`.
- Item 6: menus separados para Chat, Módulos, Biblioteca, Conexões, Dashboards, Automações, Novo módulo e Usuários; isolamento de módulos no backend e frontend.
- Item 8: formulário de conexão com banco, host, porta padrão, banco, usuário e senha; Testar conexão; Validar e conectar; credenciais cifradas e nunca retornadas.
- Item 9: API e tela inicial de dashboards com definições versionáveis; editor visual completo tipo Power BI ainda é evolução posterior.
- Item 10: tela e endpoint n8n protegidos por `N8N_BASE_URL` e `N8N_ALLOW_RUN`; o n8n ainda precisa ser instalado/configurado pelo ambiente.
- Item 11: perfis Global, Gestor e Operador aplicados ao fluxo de aprovação.
- Item 12: prompts de validação em `tests/knowledge-validation-prompts.json` e rotina de reindexação das pastas locais.
- Pipeline de fontes: status `PENDENTE`, `PROCESSANDO`, `INDEXADO`, `PARCIALMENTE_INDEXADO`, `ERRO` e `EXCLUIDO`; logs técnicos em `source_processing_logs`.
- PDF: extração página a página, trechos com página, recuperação lexical por `tsvector` e citação com arquivo/módulo/página.
- Links HTML: redirecionamentos públicos validados, remoção de `script/style/noscript` antes da indexação e reprocessamento do link original.
- Arquivos locais grandes: a leitura por reindexação usa limite separado de 500 MB; o limite do upload HTTP permanece configurável em 100 MB por padrão.
- PDF digitalizado: tentativa opcional de OCR com `pytesseract`/`pdf2image`; sem executável OCR/Poppler o status fica parcial e a resposta não afirma que o conteúdo foi recuperado.
- Módulos: catálogo genérico `knowledge_modules`, slug seguro, provisionamento das pastas e endpoint `GET/POST/PATCH /modules`.
- Migração: pastas existentes de Medicina, Infraestrutura e Almoxarifado foram preservadas e receberam a estrutura padronizada.
- Administração de fontes: listagem, reprocessamento, exclusão lógica e reindexação.

## Validações executadas

- PostgreSQL: migration 002 aplicada e grants do papel da aplicação validados.
- API: `/health` e `/auth/status` retornaram HTTP 200 com banco configurado.
- Rotas privadas novas: retornam HTTP 401 sem sessão, sem exposição de dados.
- TypeScript: `tsc --noEmit` passou.
- Frontend: `vite build` passou.
- Testes estáticos: `py_compile` passou para `server.py` e `tests/test_knowledge_architecture.py`.

## Pendente para aceite completo

- Reiniciar a API com o ambiente virtual do usuário para carregar a versão nova; o executor desta sessão não conseguiu iniciar o Python do `.venv` por restrição do launcher local.
- Executar a reindexação autenticada das pastas existentes.
- Confirmar no pgAdmin a criação/grant da tabela `knowledge_records`, `knowledge_modules`, `source_chunks` e `source_processing_logs` após o restart.
- Teste end-to-end com contas reais de Operador/Gestor e sessão Global.
- Teste end-to-end com contas reais de Operador/Gestor e sessão Global.
- SMTP para recuperação de senha e notificações.
- Drivers e credenciais dos bancos externos.
- n8n local, chave Claude e modelo local/treinamento de pesos.
- OCR de imagens e editor visual avançado de gráficos.
- Embeddings/busca vetorial: a versão atual usa busca lexical PostgreSQL; nenhum embedding foi simulado.

Importação atual é ingestão/RAG e estruturação tabular; não é treinamento automático de pesos. Conteúdo externo é tratado como dado não confiável e não pode alterar as regras do sistema.
## Melhorias recentes validadas

- PDFs grandes: o original permanece no filesystem configurado; o banco recebe metadados, hash, texto extraído e chunks pesquisáveis. Conteúdo binário só é mantido inline até `SOFIA_DB_INLINE_CONTENT_MAX_BYTES` (5 MB por padrão).
- Feedback: o chat registra avaliação positiva ou negativa por módulo em `ai_feedback`, sem treinar automaticamente ou alterar pesos do modelo sem aprovação.
- Links: a coleta remove scripts/estilos, indexa a página e pode percorrer páginas do mesmo domínio com limites de páginas e bytes.
- Zabbix: a tela de conexões agora aceita a URL web e consulta a API JSON-RPC no servidor; credenciais não são devolvidas ao navegador.
- Estabilidade: a reindexação das pastas continua exclusivamente manual para evitar travamentos ao abrir a biblioteca.

## Implementações locais desta rodada

- Parser tabular reutilizável com suporte a CSV/TSV/XLSX, cabeçalhos duplicados, limites de 10.000 registros e leitura XLSX em modo somente leitura.
- Reranking lexical determinístico e adaptador de busca semântica opcional sobre os vetores JSON já previstos na migração 006; quando o modelo local não está disponível, o sistema permanece em busca lexical.
- Cabeçalhos HTTP defensivos adicionados ao servidor local.
- Migração 009 com políticas de retenção, solicitações de titular, versões de dataset e avaliações de modelo.
- Scripts locais de backup/verificação/restauração do PostgreSQL sem sobrescrever o banco atual durante a validação.
- Pipeline de CI versionável e comando `scripts/validate-local.ps1` para repetir compilação, testes, tipos, build e integridade.
- Cobertura automatizada adicionada para política de senha, TOTP cifrado, rate limit, CSV/TSV/XLSX, entradas grandes, arquivos corrompidos, SSRF e contrato Zabbix via mock local.
- Corrigido o limite padrão de resposta do Claude para evitar cortes em respostas longas e adicionado fallback textual quando o provedor não devolve um bloco de texto.
- Habilitado o módulo Gestão Empresarial com estrutura própria e migração `010_gestao_empresarial.sql`.
- Adicionada visão gerencial do Core baseada somente em indicadores agregados, sem liberar documentos brutos entre módulos.
- Catálogo inicial de fontes públicas por módulo criado em `docs/module-seed-links.json`; a captura continua manual e sujeita a `robots.txt`.
- Script `scripts/seed-module-links.py` registrou 17 links iniciais como fontes `PENDENTE`, sem acessar sites externos; cada fonte pode ser processada pela biblioteca quando o usuário autorizar.

Essas melhorias não transformam a ingestão em treinamento automático de pesos. O treinamento/fine-tuning continua opcional, manual e bloqueado por recursos/modelos locais não configurados.
