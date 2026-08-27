param(
  [int]$ApiPort = 8000,
  [int]$WebPort = 8443
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project

Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in @($ApiPort, $WebPort) } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

$python = Join-Path $project ".venv\Scripts\python.exe"
$pythonProbe = $null
try { $pythonProbe = & $python --version 2>$null } catch { $pythonProbe = $null }
if ($LASTEXITCODE -ne 0 -or -not $pythonProbe) {
  $python = "C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe"
}
$vite = Join-Path $project "node_modules\.bin\vite.cmd"
if (-not (Test-Path $python)) { throw "Python da venv não encontrado: $python" }
if (-not (Test-Path $vite)) { throw "Vite não encontrado. Execute pnpm install primeiro." }

$env:SOFIA_PORT = "$ApiPort"
$apiOut = Join-Path $project "sofia-api.out.log"
$apiErr = Join-Path $project "sofia-api.err.log"
Start-Process -FilePath $python -ArgumentList "server.py" -WorkingDirectory $project -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr -WindowStyle Hidden | Out-Null
Start-Process -FilePath $vite -ArgumentList "--host", "127.0.0.1", "--port", "$WebPort" -WorkingDirectory $project | Out-Null

Write-Host "SOFIA API: http://127.0.0.1:$ApiPort"
Write-Host "SOFIA Web: http://127.0.0.1:$WebPort"
