param(
  [switch]$Verify
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AuditDir = Join-Path $ProjectRoot "docs\audit"
$ManifestPath = Join-Path $AuditDir "manifest.json"
$ManifestHashPath = Join-Path $AuditDir "manifest.sha256"

New-Item -ItemType Directory -Force -Path $AuditDir | Out-Null

$Excluded = @("node_modules", ".venv", "dist", "knowledge", "__pycache__", ".pytest_cache", ".git", ".runtime-site", ".figma", "logs", "docs/audit/manifest.json", "docs/audit/manifest.sha256", "docs\audit\manifest.json", "docs\audit\manifest.sha256")
$Extensions = @(".py", ".ts", ".tsx", ".css", ".sql", ".json", ".toml", ".md", ".ps1", ".html")
$files = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  $relative = $_.FullName.Substring($ProjectRoot.Length + 1)
  ($Extensions -contains $_.Extension.ToLowerInvariant()) -and
  ($Excluded | Where-Object { $relative -like "$_\*" -or $relative -eq $_ }).Count -eq 0 -and
  $_.Name -notlike ".env*"
}

$entries = @($files | Sort-Object FullName | ForEach-Object {
  $relative = $_.FullName.Substring($ProjectRoot.Length + 1).Replace("\", "/")
  $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  [ordered]@{ path = $relative; bytes = $_.Length; sha256 = $hash }
})

if ($Verify) {
  if (-not (Test-Path -LiteralPath $ManifestPath)) { throw "Manifesto não encontrado: $ManifestPath" }
  $expected = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  $actualByPath = @{}
  foreach ($entry in $entries) { $actualByPath[$entry.path] = $entry.sha256 }
  $failures = @()
  foreach ($entry in $expected.files) {
    if (-not $actualByPath.ContainsKey($entry.path) -or $actualByPath[$entry.path] -ne $entry.sha256) { $failures += $entry.path }
  }
  if ($failures.Count -gt 0) { throw ("Integridade reprovada. Arquivos alterados/ausentes: " + ($failures -join ", ")) }
  Write-Output "Integridade aprovada: $($expected.files.Count) arquivos verificados."
  exit 0
}

$manifest = [ordered]@{
  generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  project = "sofia-mcp"
  repository = "não identificado nesta pasta; histórico Git não disponível"
  files = $entries
  exclusions = $Excluded + ".env*"
  note = "Manifesto não inclui segredos, dados de conhecimento, dependências ou artefatos de build."
}
$json = $manifest | ConvertTo-Json -Depth 5
Set-Content -LiteralPath $ManifestPath -Value $json -Encoding UTF8
$manifestHash = (Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $ManifestHashPath -Value "$manifestHash  manifest.json" -Encoding ASCII
Write-Output "Manifesto criado: $ManifestPath"
Write-Output "Arquivos incluídos: $($entries.Count)"
Write-Output "Hash do manifesto: $manifestHash"
