# Copie esse arquivo pra "env.ps1" (que esta no .gitignore) e
# preencha com seus valores reais. Depois execute:
#
#   . .\stress-test\env.ps1
#
# Os ". " no inicio importam as vars na sessao atual do PowerShell.

# URLs (geralmente nao precisa mexer)
$env:LANDING_URL = "https://clinike.com.br"
$env:SYSTEM_URL  = "https://app.clinike.com.br"

# Webhook WhatsApp - SO PARA TESTE 03
# Pegue de: clinic_whatsapp.instance_name e clinic_whatsapp.webhook_token
# DICA: use instancia de teste, NAO a de producao
$env:WEBHOOK_INSTANCE = "evolution-test"
$env:WEBHOOK_TOKEN    = "cole-aqui-o-webhook-token-da-instancia-de-teste"

# Stage de teste (smoke|load|stress|spike|all)
$env:STAGE = "smoke"

# Confirmacao para webhook em modo agressivo (true|false)
$env:FORCE = "false"

Write-Host "✅ Variaveis de stress-test carregadas." -ForegroundColor Green
Write-Host "   STAGE = $env:STAGE"
Write-Host "   LANDING_URL = $env:LANDING_URL"
Write-Host "   SYSTEM_URL  = $env:SYSTEM_URL"
