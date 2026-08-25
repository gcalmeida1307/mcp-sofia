# PostgreSQL local

1. Baixe o instalador oficial em <https://www.postgresql.org/download/windows/>.
2. Durante a instalação, use:
   - porta `5432`;
   - usuário inicial `db_bootstrap`;
   - uma senha forte, guardada apenas localmente.
3. No PowerShell, dentro deste projeto, execute:

```powershell
.\scripts\setup-postgres-local.ps1
```

O script cria um banco e um usuário de aplicação com nomes aleatórios, por exemplo `vaultmesh_xxxxxxxx` e `svc_kb_xxxxxxxxxx`. O usuário da aplicação não é superusuário, não pode criar banco/usuário e recebe apenas as permissões das tabelas do MCP.

Se você instalou usando o nome padrão do PostgreSQL, informe explicitamente o usuário de bootstrap:

```powershell
.\scripts\setup-postgres-local.ps1 -BootstrapUser postgres
```

O script grava somente em `.env.local` o `DATABASE_URL` e os identificadores locais. Esse arquivo é ignorado pelo Git. O servidor lê `.env.local` antes de `.env`.
