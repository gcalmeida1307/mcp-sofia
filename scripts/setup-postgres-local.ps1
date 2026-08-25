param(
  [string]$BootstrapUser = "db_bootstrap",
  [int]$Port = 5432
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$migrationsPath = Join-Path $projectRoot "migrations"
$envFile = Join-Path $projectRoot ".env.local"

$psql = (Get-Command psql.exe -ErrorAction SilentlyContinue).Source
if (-not $psql) {
  $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending
  if ($candidates) { $psql = $candidates[0].FullName }
}
if (-not $psql) {
  throw "psql não foi encontrado. Instale o PostgreSQL pelo instalador oficial: https://www.postgresql.org/download/windows/"
}
if (-not (Test-Path $migrationsPath)) { throw "Diretório de migrações não encontrado: $migrationsPath" }

function New-RandomToken([int]$Length) {
  $chars = "abcdefghijkmnopqrstuvwxyz23456789"
  -join (1..$Length | ForEach-Object { $chars[(Get-Random -Minimum 0 -Maximum $chars.Length)] })
}

$adminPassword = Read-Host "Senha do usuário PostgreSQL '$BootstrapUser'" -AsSecureString
$adminCredential = [pscredential]::new($BootstrapUser, $adminPassword)
$adminPlain = $adminCredential.GetNetworkCredential().Password

$dbName = "vaultmesh_$(New-RandomToken 8)"
$appRole = "svc_kb_$(New-RandomToken 10)"
$appPassword = New-RandomToken 40
$escapedAppPassword = $appPassword.Replace("'", "''")

$env:PGPASSWORD = $adminPlain
try {
  & $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível autenticar no PostgreSQL local." }

  $roleQuery = @(& $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d postgres -Atqc "SELECT 1 FROM pg_roles WHERE rolname = '$appRole'")
  $roleExists = (($roleQuery -join "").Trim())
  if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar usuários PostgreSQL." }
  if ($roleExists -ne "1") {
    $createRoleSql = "CREATE ROLE `"$appRole`" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '$escapedAppPassword';"
    & $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d postgres -v ON_ERROR_STOP=1 -c $createRoleSql
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar usuário de aplicação." }
  }

  $databaseQuery = @(& $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$dbName'")
  $databaseExists = (($databaseQuery -join "").Trim())
  if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar bancos PostgreSQL." }
  if ($databaseExists -ne "1") {
    & $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE `"$dbName`" OWNER `"$appRole`";"
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar banco de aplicação." }
  }
  & $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d postgres -v ON_ERROR_STOP=1 -c "REVOKE ALL ON DATABASE `"$dbName`" FROM PUBLIC; GRANT CONNECT ON DATABASE `"$dbName`" TO `"$appRole`";" | Out-Null

  $databaseUrl = "postgresql+psycopg://$appRole`:$appPassword@127.0.0.1`:$Port/$dbName?sslmode=prefer"
  $migrationFiles = Get-ChildItem -LiteralPath $migrationsPath -Filter "*.sql" | Sort-Object Name
  foreach ($migrationFile in $migrationFiles) {
    & $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d $dbName -v ON_ERROR_STOP=1 -f $migrationFile.FullName
    if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar a migração PostgreSQL: $($migrationFile.Name)" }
  }
  $grantSql = "GRANT USAGE ON SCHEMA public TO `"$appRole`"; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO `"$appRole`"; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO `"$appRole`";"
  & $psql -h 127.0.0.1 -p $Port -U $BootstrapUser -d $dbName -v ON_ERROR_STOP=1 -c $grantSql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar privilégios mínimos ao usuário da aplicação." }

  @(
    "DATABASE_URL=$databaseUrl"
    "SOFIA_DB_NAME=$dbName"
    "SOFIA_DB_ROLE=$appRole"
  ) | Set-Content -Path $envFile -Encoding utf8
  $aclResult = & icacls $envFile /inheritance:r /grant:r "$($env:USERNAME):M" 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Não foi possível ajustar a ACL de .env.local automaticamente. Verifique as permissões do arquivo manualmente."
  }
  Write-Host "PostgreSQL configurado localmente." -ForegroundColor Green
  Write-Host "Banco: $dbName"
  Write-Host "Usuário da aplicação: $appRole"
  Write-Host "Arquivo local: $envFile"
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
