# Runner do Clinike Stress Test
#
# Uso:
#   . .\stress-test\env.ps1               # carrega variaveis (uma vez por sessao)
#   .\stress-test\run.ps1                 # smoke completo (landing + system)
#   .\stress-test\run.ps1 -Stage load     # load nos dois (sem webhook)
#   .\stress-test\run.ps1 -Webhook        # inclui webhook test (!)
#   .\stress-test\run.ps1 -Stage all -Webhook -Force  # full stress
#
# Pre-requisitos:
#   - k6 instalado (winget install k6 OU choco install k6)
#   - env.ps1 preenchido (copia de env.example.ps1)

[CmdletBinding()]
param(
  [ValidateSet('smoke','load','stress','spike','all')]
  [string]$Stage = 'smoke',
  [switch]$Webhook,
  [switch]$Force,
  [switch]$LandingOnly,
  [switch]$SystemOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Verificar k6
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  Write-Host "❌ k6 nao encontrado. Instale com:" -ForegroundColor Red
  Write-Host "   winget install k6 --source winget"
  Write-Host "   OU baixe de https://k6.io/docs/get-started/installation/"
  exit 1
}

# Garantir pasta de resultados
$results = Join-Path $root 'results'
if (-not (Test-Path $results)) { New-Item -ItemType Directory -Path $results | Out-Null }

# Setar STAGE no env
$env:STAGE = $Stage
if ($Force) { $env:FORCE = 'true' } else { $env:FORCE = 'false' }

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CLINIKE STRESS TEST RUNNER" -ForegroundColor Cyan
Write-Host "  Stage: $Stage  |  Webhook: $Webhook  |  Force: $Force" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$failed = @()

# ----- TESTE 01: LANDING -----
if (-not $SystemOnly) {
  Write-Host ">>> [01/3] LANDING TEST" -ForegroundColor Yellow
  $logFile = Join-Path $results "landing-$Stage-$timestamp.log"
  & k6 run --quiet (Join-Path $root '01-landing.js') 2>&1 | Tee-Object -FilePath $logFile
  if ($LASTEXITCODE -ne 0) { $failed += "landing" }
  Write-Host ""
}

# ----- TESTE 02: SISTEMA -----
if (-not $LandingOnly) {
  Write-Host ">>> [02/3] SYSTEM TEST" -ForegroundColor Yellow
  $logFile = Join-Path $results "system-$Stage-$timestamp.log"
  & k6 run --quiet (Join-Path $root '02-system.js') 2>&1 | Tee-Object -FilePath $logFile
  if ($LASTEXITCODE -ne 0) { $failed += "system" }
  Write-Host ""
}

# ----- TESTE 03: WEBHOOK (so se -Webhook) -----
if ($Webhook -and (-not $LandingOnly)) {
  if (-not $env:WEBHOOK_INSTANCE -or -not $env:WEBHOOK_TOKEN) {
    Write-Host "❌ WEBHOOK_INSTANCE e WEBHOOK_TOKEN obrigatorios pra teste 03" -ForegroundColor Red
    Write-Host "   Carregue env.ps1 primeiro: . .\stress-test\env.ps1"
    exit 2
  }
  Write-Host ">>> [03/3] WEBHOOK TEST  (TESTE INVASIVO)" -ForegroundColor Magenta
  Write-Host "   Instance: $env:WEBHOOK_INSTANCE"
  $logFile = Join-Path $results "webhook-$Stage-$timestamp.log"
  & k6 run --quiet (Join-Path $root '03-webhook.js') 2>&1 | Tee-Object -FilePath $logFile
  if ($LASTEXITCODE -ne 0) { $failed += "webhook" }
}

# ----- RELATORIO FINAL -----
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
if ($failed.Count -eq 0) {
  Write-Host "  ✅ TODOS OS TESTES PASSARAM" -ForegroundColor Green
} else {
  Write-Host "  ❌ FALHAS EM: $($failed -join ', ')" -ForegroundColor Red
}
Write-Host "  Resultados em: stress-test\results\" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($Webhook) {
  Write-Host "⚠️  Lembre-se de limpar dados de teste apos webhook stress." -ForegroundColor Yellow
  Write-Host "   Veja stress-test\SAFETY.md" -ForegroundColor Yellow
}
