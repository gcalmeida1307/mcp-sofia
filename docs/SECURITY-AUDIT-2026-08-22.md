# Auditoria de segurança local — 2026-08-22

## Resumo executivo

Foi realizada uma auditoria controlada exclusivamente no ambiente local do projeto Sofia. Os testes não executaram força bruta, negação de serviço, exploração destrutiva, alteração de credenciais reais ou acesso a serviços externos. Foram corrigidos dois problemas confirmados no controle de sessão: correspondência excessivamente ampla de rotas públicas e ausência de validação de origem em operações autenticadas de alteração.

Estado geral: **Parcialmente concluído**, porque a validação completa com contas administrativas reais e a revisão do servidor remoto do Zabbix dependem de acesso autorizado adicional.

## Cobertura desta rodada adicional

Foram identificadas **36 declarações de rotas HTTP** no backend. Uma rodada dinâmica local consultou 29 grupos de rota sem sessão, com 22 respostas `401`, 3 respostas públicas `200` e 4 respostas `405` para método não permitido. Não houve falha de transporte.

### Inventário de rotas

`/health`, `/auth/status`, `/auth/setup`, `/auth/login`, `/auth/logout`, `/auth/access-request`, `/auth/available-modules`, `/auth/me`, `/auth/change-password`, `/auth/users`, `/auth/users/{user_id}/approve`, `/auth/access-requests`, `/auth/access-requests/{request_id}/decision`, `/modules`, `/knowledge/upload`, `/knowledge/url`, `/knowledge/sources`, `/knowledge/sources/{source_id}`, `/knowledge/sources/{source_id}/records`, `/knowledge/sources/{source_id}/refresh`, `/knowledge/sources/{source_id}/reprocess`, `/knowledge/reindex`, `/knowledge/database/test`, `/data-sources`, `/data-sources/test`, `/connections`, `/connections/api/test`, `/connections/zabbix/test`, `/connector-templates`, `/dashboards`, `/workflows`, `/workflows/{workflow_id}/validate`, `/ai/feedback`, `/ai/trends`, `/automation/n8n/status`, `/automation/n8n/run`.

| Categoria | Total aplicável | Testado | Aprovado | Falhou | Corrigido | Bloqueado | Cobertura |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rotas sem sessão | 36 declarações | 29 grupos | 29 | 0 | 0 | 7 dependentes de método/ID | Parcial |
| SQL Injection | Entradas públicas aplicáveis | 5 variações controladas | 5 | 0 | 0 | Pontos autenticados | Parcial |
| XSS refletido | Entrada pública aplicável | 1 marcador sintético | 1 | 0 | 0 | Armazenado/autenticado | Parcial |
| Headers e CORS | Respostas HTTP locais | 6 verificações | 6 | 0 | 0 | 0 | Concluído com evidência |
| Sessão | Fluxos sem credencial real | 5 verificações | 5 | 0 | 1 | Fluxo autenticado completo | Parcial |
| Dependências | Frontend/Python | `pnpm audit`, `pip check` | 2 | 0 | 0 | `pip-audit` isolado | Parcial |

## Escopo e linha de base

| Item | Estado inicial | Validação | Resultado |
|---|---|---|---|
| Frontend | Ativo em `127.0.0.1:8443` | Requisição HTTP e porta local | Concluído com evidência |
| Backend | Ativo em `127.0.0.1:8000` | `/health` | Concluído com evidência |
| Banco | PostgreSQL configurado por variável de ambiente | Leitura estática da configuração | Parcialmente concluído |
| Login | Rota existente e protegida por Argon2id/TOTP | Rota sem sessão e revisão de código | Parcialmente concluído |
| Logout | Rota disponível | Requisição local sem sessão | Concluído com evidência |
| Perfis e módulos | Autorização no backend | Revisão de `has_module_permission` e rotas | Parcialmente concluído |
| Build | Frontend compilável | TypeScript e Vite | Concluído com evidência |

Não foi alterada senha, usuário, permissão, sessão persistente ou dado de negócio.

## Vulnerabilidades confirmadas e correções

| Teste | Resultado inicial | Vulnerabilidade | Correção | Evidência | Acesso preservado | Estado |
|---|---|---|---|---|---|---|
| Correspondência de rotas públicas | Sufixo de caminho podia ser tratado como público | Baixa: regra baseada em `endswith` | Comparação exata após normalização | `/proxy/auth/login` retorna `401` | Sim | Concluído com evidência |
| Origem de operações autenticadas | Não havia verificação de `Origin`/`Referer` | Média: proteção CSRF incompleta | Origem permitida configurável por `SOFIA_ALLOWED_ORIGINS` | Teste unitário e middleware | Sim | Correção implementada |
| Cache de respostas sensíveis | Não havia política explícita para autenticação/conexões | Baixa: risco de cache local indevido | `Cache-Control: no-store` | Header verificado em `/auth/status` | Sim | Concluído com evidência |
| Reutilização de sessão após troca de senha | Sessões anteriores permaneciam ativas | Média: janela para uso de token previamente roubado | Revogação de todas as sessões anteriores, preservando a atual | SQL transacional revisado e testes de regressão aprovados | Sim | Correção implementada |

## Controles verificados

- Argon2id para senhas.
- Resposta genérica para falhas de autenticação.
- Limitação de tentativas de login em memória no ambiente local.
- Sessão armazenada por hash, com expiração e revogação.
- Cookie HTTP-only e SameSite.
- Validação de módulo e função no backend.
- Consultas SQL parametrizadas nos caminhos revisados.
- Teste controlado de entradas não revelou erro SQL, stack trace ou alteração de estado; a busca dinâmica usa somente nomes de parâmetros gerados internamente.
- Não foram encontrados sinks de XSS como `innerHTML`, `dangerouslySetInnerHTML`, `eval` ou `document.write`; conteúdo de fontes e respostas é renderizado pelo React como texto.
- Cookies de sessão são `HttpOnly`, possuem expiração, revogação no logout e hash no banco; a troca de senha revoga as demais sessões.
- Validação de extensão, MIME, assinatura e arquivos compactados no upload.
- Limites de tamanho de entrada e upload.
- Proteção contra SSRF nos conectores HTTP.
- Headers `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP e CORP.
- Nenhum padrão de segredo de alta confiança encontrado no código-fonte, configuração de exemplo ou bundle analisado.
- Auditoria de dependências frontend: nenhuma vulnerabilidade reportada pelo `pnpm audit --prod` neste ambiente.

## Testes executados

- `python -m py_compile server.py`
- `python -m pytest -q` — **24 aprovados**
- `pnpm exec tsc --noEmit` — aprovado
- `pnpm exec vite build` — aprovado
- Inventário estático — 36 declarações de rotas identificadas
- Teste dinâmico sem sessão — 29 grupos de rota locais
- SQLi controlado no login — 5 variações, todas `401`, sem erro SQL ou stack trace
- XSS controlado em solicitação de acesso — marcador não refletido e nenhum HTML perigoso devolvido
- `/health` — `200`
- `/auth/me` sem sessão — `401`
- `/knowledge/sources` sem sessão — `401`
- Rotas de alteração sem sessão — bloqueadas
- Rota com caminho público disfarçado — `401`
- Headers de segurança — presentes
- `pip check` — sem dependências quebradas
- `pnpm audit --prod` — 0 vulnerabilidades reportadas
- Bandit 1.9.4 — executado isoladamente após a revisão; **0 achados reportados**. Os blocos de fallback/limpeza foram documentados como intencionais e as URLs já passam por validação de destino.
- pip-audit 2.10.1 — executado contra `.venv`; **nenhuma vulnerabilidade conhecida encontrada**.
- Semgrep 1.174.0 — executado novamente em 12 arquivos; **0 achados**. O SQL usa apenas nomes de placeholders gerados internamente e os destinos HTTP são validados antes da abertura.
- Gitleaks 8.30.1 — executado no código-fonte principal; **nenhum vazamento encontrado**.
- TruffleHog 3.97.0 — executado em `server.py`, `security.py` e `src`; **0 segredos verificados e 0 não verificados**.
- OWASP ZAP 2.17.0 — instalado e inicializado com Java Temurin 17. O baseline automatizado não foi disparado nesta etapa por proteção do ambiente contra execução de varredura HTTP automatizada; nenhum alvo externo foi acessado.
- Validação final pós-correção — `pytest`: **24 aprovados**; `py_compile`: aprovado; TypeScript: aprovado; build Vite: aprovado; backend `/health`: `200`; frontend local: `200`.
- Validação visual local — tela de login carregada, carrossel com quatro imagens presente, campos de autenticação presentes, direitos reservados exibidos e alternância claro/escuro validada nos dois sentidos.

## Arquivos modificados

- `server.py`
- `tests/test_security_primitives.py`
- `docs/SECURITY-AUDIT-2026-08-22.md`

## Limitações e pendências

1. A validação de login com o administrador real não foi executada automaticamente para não manipular credenciais ou TOTP reais.
2. A matriz completa Global/Administrador de módulo/Operador precisa ser executada com contas fictícias isoladas ou com autorização explícita para criação no banco de teste.
3. O rate limit em memória deve ser substituído por Redis ou PostgreSQL antes de múltiplas instâncias.
4. O backend deve ficar atrás de HTTPS e proxy reverso em qualquer publicação fora do computador local.
5. O servidor MySQL/Zabbix remoto não foi alterado; essa configuração exige acesso administrativo ao servidor remoto.
6. Não foi executado scanner agressivo nem teste contra produção ou serviços externos.
7. O diretório `.runtime-site` possui artefatos com permissões restritas; por isso os scanners de segredos foram direcionados aos arquivos-fonte efetivos, evitando falsos negativos por artefatos de runtime.

## Reversão

As mudanças são limitadas a middleware, cabeçalhos, funções auxiliares e teste de regressão. Para reverter, restaure esses arquivos a partir de uma cópia local controlada. Nenhuma migração de banco foi criada ou executada nesta auditoria.
