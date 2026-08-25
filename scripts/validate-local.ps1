$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  & .\.venv\Scripts\python.exe -m py_compile server.py
  & .\.venv\Scripts\python.exe -m pytest -q
  & pnpm exec tsc --noEmit
  & pnpm build
  & .\scripts\audit-project.ps1 -Verify
  Write-Output "VALIDACAO_LOCAL=PASS"
} finally { Pop-Location }
