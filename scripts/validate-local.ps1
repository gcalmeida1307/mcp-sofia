$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $python = Join-Path $root ".venv\Scripts\python.exe"
  $probe = $null
  try { $probe = & $python -c "import anthropic; print(anthropic.__file__)" 2>$null } catch { $probe = $null }
  if ($LASTEXITCODE -ne 0 -or -not $probe) { $python = "C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe" }
  $probe = & $python -c "import anthropic; print(anthropic.__file__)" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $probe) { throw "Pacote anthropic nao esta disponivel no runtime Python: $python" }
  & $python -m py_compile server.py
  & $python -m pytest -q
  & pnpm exec tsc --noEmit
  & pnpm build
  & .\scripts\audit-project.ps1 -Verify
  Write-Output "VALIDACAO_LOCAL=PASS"
} finally { Pop-Location }
