# Relatório de auditoria e execução — SOFIA

Data: 22/08/2026  
Escopo: `sofia-mcp` local  
Tipo: auditoria técnica e evidência reproduzível

## Limitação de rastreabilidade

Esta pasta não contém um repositório Git identificável. Portanto, não é possível provar neste relatório o estado anterior, autoria histórica ou diferença completa entre versões anteriores. Para reduzir essa limitação, foi criado um manifesto SHA-256 em `docs/audit/manifest.json`, acompanhado de `manifest.sha256` e do verificador `scripts/audit-project.ps1 -Verify`.

O manifesto exclui segredos, `.env*`, dependências, dados de conhecimento e artefatos de build. Ele comprova a integridade dos arquivos de código e configuração incluídos no momento da auditoria; não é armazenamento imutável. Para evidência forte de pentest, o hash deve ser guardado em Git/CI, cofre ou armazenamento WORM externo.

## Arquitetura encontrada

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 4.
- Backend: Python 3.11, Starlette/Uvicorn, MCP, Anthropic SDK.
- Persistência: PostgreSQL via SQLAlchemy; migrações SQL versionadas.
- Segurança: Argon2id, TOTP, sessões, controle por módulo/perfil, validação de upload, proteção de URL remota e auditoria de autenticação.
- Conhecimento: arquivos em `knowledge/<modulo>/<tipo>`, fontes versionadas, extração de PDF/DOCX/TXT/HTML e materialização de CSV/TSV/XLSX em `knowledge_records`.
- IA: recuperação lexical, histórico de consultas, feedback, análise estatística e dashboards automáticos. Isso é ingestão/RAG e análise; não é treinamento automático de pesos do modelo.

## Checklist

| Área | Estado | Evidência/observação |
|---|---|---|
| Estrutura e separação de módulos | Concluído | `knowledge/<modulo>/<bucket>` e `MODULE_FOLDERS` |
| Autenticação e TOTP | Concluído | Argon2id, aprovação Global e QR/manual |
| Autorização por perfil/módulo | Concluído | Rotas privadas e `has_module_permission` |
| Upload e processamento | Parcialmente concluído | Extensões, MIME/magic bytes e limites; faltam testes completos de pentest |
| CSV/TSV/XLSX | Concluído | Detecção de separador e codificações comuns; limite de registros documentado |
| Links e fontes | Parcialmente concluído | Crawl controlado e `robots.txt`; páginas JS exigem navegador/headless |
| Dashboards estatísticos | Parcialmente concluído | Tendência, distribuição, temas e gráficos; editor tipo Power BI ainda não completo |
| Conexões de bancos | Parcialmente concluído | Teste, portas padrão e descoberta de tabelas; drivers/servidores externos dependem do ambiente |
| APIs/Zabbix | Parcialmente concluído | Token/Basic e feedback; conectividade depende da rede do servidor |
| Auditoria reproduzível | Concluído | Manifesto SHA-256 e verificador adicionados nesta execução |
| Responsividade | Parcialmente concluído | Layout responsivo implementado; faltam testes em dispositivos reais |
| Acessibilidade WCAG AA | Parcialmente concluído | Foco, labels e redução de movimento presentes; ainda requer auditoria automatizada/manual |
| Dependências e vulnerabilidades | Pendente | Requer ferramenta de scanner e atualização controlada |
| Backup e restauração | Pendente | Requer política, mídia e teste de restauração definidos |
| HTTPS/proxy/produção | Pendente | Ambiente atual é local e HTTP |

## Alterações desta auditoria e rodada complementar

- Criado `scripts/audit-project.ps1` para gerar e verificar hashes SHA-256 sem expor segredos.
- Criado este relatório com arquitetura, limitações, riscos e checklist.
- Mantidas as alterações existentes; não foram removidos dados, tabelas ou arquivos de conhecimento.
- Adicionado parser tabular reutilizável com limites, duplicidade de cabeçalhos e leitura XLSX somente leitura.
- Adicionado reranking local e adaptador de busca semântica opcional com fallback lexical.
- Adicionados cabeçalhos HTTP defensivos no servidor local.
- Criada a migração aditiva `009_governance_and_dataset.sql` para retenção, solicitações de titular e datasets avaliáveis.
- Criados scripts de backup/restauração com verificação SHA-256 e restauração direcionada a banco de destino.
- Criado `scripts/validate-local.ps1` e pipeline `.github/workflows/ci.yml`.
- Adicionados testes locais para autenticação, TOTP, rate limit, tabulares, arquivos corrompidos, SSRF e contrato Zabbix mockado.

## Validações executadas

- `python -m py_compile server.py`: aprovado.
- `python -m pytest -q`: 18 testes aprovados.
- `pnpm exec tsc --noEmit`: aprovado.
- `pnpm build`: aprovado.
- Backend `/health`: HTTP 200 confirmado durante a execução.
- Frontend Vite em `http://127.0.0.1:8443`: serviço reiniciado e respondendo.
- `scripts/audit-project.ps1`: manifesto gerado sem ler valores de `.env`.
- `scripts/audit-project.ps1 -Verify`: deve ser executado após qualquer alteração para detectar divergências.
- `scripts/validate-local.ps1`: aprovado, incluindo testes, tipos, build e manifesto.
- Cabeçalhos HTTP `/health`: `nosniff`, `DENY`, política de referrer e políticas cross-origin confirmados.
- Migrações `009_governance_and_dataset.sql` e `010_gestao_empresarial.sql`: aplicadas no PostgreSQL local.
- `/health`: Gestão Empresarial aparece entre os módulos ativos.
- Core gerencial: teste local confirmou consolidação de indicadores sem conteúdo bruto de outros módulos.
- Diretórios do módulo Gestão Empresarial: sete pastas padronizadas confirmadas.
- Catálogo de links: 17 fontes iniciais registradas como `PENDENTE`, sem download externo.

## Riscos remanescentes

1. Sem Git disponível nesta pasta não há histórico de autoria; foi criado um pipeline versionável, mas ele só será executado após o projeto estar hospedado em um repositório.
2. Conexões externas dependem de rota de rede, firewall, DNS, drivers e credenciais válidas.
3. A aplicação ainda não deve ser considerada aprovada para produção ou pentest sem DAST/SAST, varredura de dependências, teste de carga, revisão de SSRF/upload e teste de restauração.
4. A migração 009 prepara governança, retenção e datasets, mas ainda precisa ser aplicada ao PostgreSQL. Dados médicos, trabalhistas e pessoais exigem validação operacional e jurídica adicional.

## Próximas ações recomendadas

1. Inicializar Git privado e armazenar o hash do manifesto em CI.
2. Executar scanner de dependências e DAST autenticado.
3. Adicionar testes E2E para login/TOTP, perfis, upload, links, bancos e API.
4. Configurar backup criptografado do PostgreSQL e realizar restauração de teste.
5. Definir proxy reverso HTTPS, cabeçalhos, CORS e política de produção.
6. Aplicar `migrations/009_governance_and_dataset.sql` com `psql` após confirmar o banco local.

## Como verificar

No PowerShell, a partir da pasta do projeto:

```powershell
.\scripts\audit-project.ps1
.\scripts\audit-project.ps1 -Verify
```

O segundo comando deve informar `Integridade aprovada`. Se houver alteração, ele lista os arquivos divergentes sem revelar conteúdo sensível.
