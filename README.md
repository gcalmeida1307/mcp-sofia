# Sofia MCP

Primeira base do MCP modular com um Core chamado Sofia.

## Regras de isolamento

- O Core conhece apenas os módulos ativos e suas descrições.
- Cada módulo possui um diretório de conhecimento próprio.
- Uma pergunta é encaminhada a um único módulo por vez.
- O prompt e o contexto de um módulo não são enviados a outro módulo.
- Medicina fica preparada para receber controles adicionais de acesso e auditoria antes de dados reais.

## Executar localmente

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
Copy-Item .env.example .env
ollama pull qwen3.5:2b
python server.py
```

O servidor usa Streamable HTTP em `http://127.0.0.1:8000/mcp`.

## Configuração

Edite `.env` e defina `ANTHROPIC_API_KEY` somente se quiser o fallback Claude. Nunca envie essa chave pelo chat ou a inclua no Git. O modelo local padrão é `qwen3.5:2b`, adequado a computadores mais simples. Em máquinas com mais memória, `qwen3.5:4b` melhora a qualidade; altere apenas `SOFIA_LOCAL_AI_MODEL`.

O fluxo de resposta é: RAG isolado do módulo → Qwen local → Claude opcional quando a resposta local estiver indisponível ou inconclusiva. O Claude recebe os mesmos trechos recuperados da RAG. Respostas só viram memória reutilizável depois de feedback positivo e aprovação para o dataset; isso evita que uma resposta errada se autoalimente.

## Atualizar uma instalação existente

Antes de iniciar esta versão, aplique as migrações em ordem com o script local. A migração 015 é aditiva: mantém usuários, sessões e permissões já ativos e acrescenta os estados de ativação.

```powershell
.\scripts\setup-postgres-local.ps1
```

O fluxo profissional fica separado em: solicitação pública → decisão do Global → senha criada pelo usuário → QR/TOTP → acesso aos módulos. A sessão intermediária serve apenas para configurar o autenticador e não abre dados da plataforma.

Os módulos iniciais ativos são definidos por `SOFIA_MODULES`. Para ativar Almoxarifado:

```text
SOFIA_MODULES=infraestrutura,medicina,almoxarifado
```
