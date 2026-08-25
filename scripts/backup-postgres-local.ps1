param(
  [string]$OutputDirectory = "$PSScriptRoot\..\backups",
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"
if (-not $DatabaseUrl) { throw "Defina DATABASE_URL no ambiente antes do backup." }
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) { throw "pg_dump não encontrado. Instale o PostgreSQL Command Line Tools." }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path (Resolve-Path $OutputDirectory) "sofia-$stamp.dump"
$env:PGPASSWORD = $null
& $pgDump.Source --dbname=$DatabaseUrl --format=custom --no-owner --no-privileges --file=$target
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou." }
$hash = Get-FileHash -LiteralPath $target -Algorithm SHA256
@{ path = $target; sha256 = $hash.Hash.ToLowerInvariant(); bytes = (Get-Item $target).Length; created_at = (Get-Date).ToUniversalTime().ToString("o") } |
  ConvertTo-Json | Set-Content -LiteralPath "$target.sha256.json" -Encoding UTF8
Write-Output "Backup criado: $target"
Write-Output "SHA256: $($hash.Hash.ToLowerInvariant())"
