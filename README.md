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
python server.py
```

O servidor usa Streamable HTTP em `http://127.0.0.1:8000/mcp`.

## Configuração

Edite `.env` e defina `ANTHROPIC_API_KEY`. Nunca envie essa chave pelo chat ou a inclua no Git.

Os módulos iniciais ativos são definidos por `SOFIA_MODULES`. Para ativar Almoxarifado:

```text
SOFIA_MODULES=infraestrutura,medicina,almoxarifado
```

