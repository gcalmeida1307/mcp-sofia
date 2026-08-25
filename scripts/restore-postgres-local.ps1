param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [Parameter(Mandatory=$true)][string]$TargetDatabaseUrl
)

$ErrorActionPreference = "Stop"
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) { throw "pg_restore não encontrado. Instale o PostgreSQL Command Line Tools." }
if (-not (Test-Path -LiteralPath $BackupFile)) { throw "Backup não encontrado." }
$sidecar = "$BackupFile.sha256.json"
if (Test-Path $sidecar) {
  $expected = (Get-Content -Raw $sidecar | ConvertFrom-Json).sha256
  $actual = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw "Integridade do backup reprovada." }
}
& $pgRestore.Source --dbname=$TargetDatabaseUrl --clean --if-exists --no-owner --no-privileges $BackupFile
if ($LASTEXITCODE -ne 0) { throw "pg_restore falhou." }
Write-Output "Restauração concluída no banco de destino informado."
