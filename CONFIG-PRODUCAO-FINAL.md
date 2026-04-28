# 🚀 Finalização do setup em produção

> Criado em 28/04/2026 — sessão de hardening + integração de anamnese.
>
> Tudo que não pude executar daqui (precisa de painel externo) está
> documentado passo-a-passo. Após terminar, marca os checkboxes.

---

## ✅ Já feito nesta sessão (referência)

- [x] 7 fixes de segurança (commits `a6cbf97` em diante)
- [x] Botão "Anamnese" no popover da agenda (`2c17ecb`)
- [x] Card de anamnese no atendimento + integração no histórico (`f79a605`)
- [x] Auditoria do `signature_ip` validada em prod (`6da0fb4`)
- [x] Sanitizar `/api/admin/logs` (`4be963e`)
- [x] Validador de DV do CPF (`abca36b`)
- [x] UA + país nas assinaturas (`b475c87`)
- [x] **Migração SQL `add-signature-evidence-fields.sql` rodada** ✓ confirmado pelo usuário em 28/04 13h35

---

## 🔴 Ação 1 — Configurar `x-cliniq-secret` no n8n

### Por que isso é urgente

Depois do **Fix #1**, o endpoint `POST /api/webhooks/n8n` exige o header
`x-cliniq-secret` igual ao valor de `N8N_WEBHOOK_SECRET` na Vercel.

Sem essa configuração no n8n:
- Donna confirma um agendamento via WhatsApp → POST do n8n vai pro
  webhook → recebe **401 Unauthorized** → confirmação não chega na
  agenda da clínica.
- Mesma coisa pra cancelamento e captura de novos leads.

### Passo a passo no n8n

#### 1.1 Pegar o valor do `N8N_WEBHOOK_SECRET`

1. Vercel Dashboard → projeto **cliniq-10** → **Settings** → **Environment Variables**
2. Procurar `N8N_WEBHOOK_SECRET`
3. Clicar no olhinho 👁️ pra revelar o valor → **copiar**

#### 1.2 Criar a Credential no n8n

1. n8n → menu lateral → **Credentials** → **+ Add credential**
2. Buscar e selecionar **Header Auth**
3. Preencher:
   - **Credential Name:** `Cliniq Webhook Secret` (ou nome de tua preferência)
   - **Name:** `x-cliniq-secret`  (este é o nome do HEADER, exatamente assim, lowercase)
   - **Value:** colar o valor do `N8N_WEBHOOK_SECRET` da Vercel
4. **Save**

#### 1.3 Aplicar a credential nos HTTP Request nodes

Em **TODOS** os workflows que batem em `https://cliniq-10.vercel.app/api/webhooks/n8n`:

1. Abrir o workflow
2. Cada **HTTP Request** node que aponta pro endpoint:
   - Aba **Authentication** → mudar pra **Generic Credential Type**
   - **Generic Auth Type** → **Header Auth**
   - **Credential** → selecionar `Cliniq Webhook Secret`
3. **Save** o workflow

> 💡 Se há vários workflows (Donna, confirmação, cancelamento, lead),
> repetir em cada um. Não dá pra fazer em massa pelo n8n cloud — só um
> por um.

#### 1.4 Testar (do seu terminal)

Antes de configurar no n8n, o webhook DEVE devolver 401:

```powershell
# PowerShell — espera 401
curl.exe -i -X POST "https://cliniq-10.vercel.app/api/webhooks/n8n" `
  -H "content-type: application/json" `
  -d '{\"event\":\"ping\"}'
```

Resposta esperada:
```
HTTP/1.1 401 Unauthorized
{"error":"Nao autorizado"}
```

Agora teste com o header correto (substituindo `<seu_secret>`):

```powershell
# PowerShell — espera 200 (ou 400 com mensagem do payload, NUNCA 401)
curl.exe -i -X POST "https://cliniq-10.vercel.app/api/webhooks/n8n" `
  -H "content-type: application/json" `
  -H "x-cliniq-secret: <seu_secret>" `
  -d '{\"event\":\"ping\"}'
```

#### 1.5 Validar com fluxo real

Depois disso:
- [ ] Disparar manualmente um workflow do n8n que confirma agendamento
- [ ] Conferir na agenda do dashboard se o status mudou pra `confirmed`
- [ ] Conferir os logs do n8n: HTTP Request node retornou 200

---

## 🟡 Ação 2 — `SUPABASE_SERVICE_ROLE_KEY` "Needs Attention" na Vercel

### O que é o aviso

A Vercel detectou que essa variável tem um valor sensível (formato JWT
do Supabase) mas **não está marcada como Sensitive**. Resultado: o
valor é exibido em texto plano na lista de envs e fica logado em build
output.

### Passos

1. Vercel Dashboard → projeto **cliniq-10** → **Settings** → **Environment Variables**
2. Achar `SUPABASE_SERVICE_ROLE_KEY` (deve estar marcado em amarelo "Needs Attention")
3. Clicar no botão `...` à direita → **Edit**
4. **Copiar o valor atual** primeiro (clicar no olhinho 👁️ pra revelar e copiar pro clipboard)
5. **Excluir** a variável (botão Delete)
6. **+ Add Another** → criar de novo:
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: colar o valor copiado
   - **Marcar a checkbox "Sensitive"** ✅
   - Environments: ☑ Production, ☑ Preview, ☐ Development (ou conforme uso)
7. **Save**

### Validação

Depois de salvar, a env volta verde (sem alerta). O valor não aparece
mais nas builds.

---

## 🟡 Ação 3 — Forçar redeploy sem cache

### Por quê

Você adicionou/atualizou várias envs (`CRON_SECRET`, `N8N_WEBHOOK_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`). Builds em cache podem ter pegado valores
antigos.

### Passos

1. Vercel Dashboard → projeto **cliniq-10** → **Deployments**
2. Localizar o deployment mais recente da branch `main` (deve ser o
   commit `b475c87` ou mais novo)
3. Botão `...` → **Redeploy**
4. **DESMARCAR** a checkbox `Use existing Build Cache`
5. **Redeploy**
6. Aguardar (~2-3 min). Status precisa virar **Ready** (verde).

---

## 🧪 Bateria de testes finais (depois das 3 ações)

Cole tudo no PowerShell, substituindo `<CRON_SECRET>` e `<N8N_SECRET>` pelos
valores reais da Vercel.

### Healthcheck básico
```powershell
curl.exe -i "https://cliniq-10.vercel.app/api/health" 2>$null
# Esperado: 200 (ou 404 se não existir; nesse caso pula)
```

### Cron deve devolver 401 sem secret
```powershell
curl.exe -i "https://cliniq-10.vercel.app/api/cron/appointment-reminders"
# Esperado: 401 unauthorized
```

### Cron deve aceitar com secret correto (e devolver 200/204)
```powershell
$cron = "<CRON_SECRET>"
curl.exe -i -H "Authorization: Bearer $cron" `
  "https://cliniq-10.vercel.app/api/cron/appointment-reminders"
# Esperado: 200 com {ok: true, ...}
```

### Webhook n8n deve devolver 401 sem header
```powershell
curl.exe -i -X POST "https://cliniq-10.vercel.app/api/webhooks/n8n" `
  -H "content-type: application/json" -d '{}'
# Esperado: 401
```

### Webhook n8n com header correto
```powershell
$n8n = "<N8N_SECRET>"
curl.exe -i -X POST "https://cliniq-10.vercel.app/api/webhooks/n8n" `
  -H "content-type: application/json" `
  -H "x-cliniq-secret: $n8n" `
  -d '{\"event\":\"ping\"}'
# Esperado: 200 ou 400 com erro de payload (NUNCA 401)
```

### Anamnese: signature_user_agent + country gravando

Depois que algum paciente preencher uma nova anamnese, no Supabase SQL
Editor:

```sql
select
  id,
  signature_ip,
  signature_country,
  case
    when signature_user_agent ilike '%firefox%' then 'Firefox'
    when signature_user_agent ilike '%edg/%'    then 'Edge'
    when signature_user_agent ilike '%chrome%'  then 'Chrome'
    when signature_user_agent ilike '%safari%'  then 'Safari'
    else 'Outro'
  end as navegador,
  completed_at
from anamneses
where status = 'completed'
order by completed_at desc nulls last
limit 5;
```

**Esperado pra registros novos:** `signature_country = 'BR'`, navegador
preenchido (Chrome/Safari/Firefox).

---

## 📋 Checklist final pra fechar a sessão

- [ ] **Ação 1** — Credential `x-cliniq-secret` criada no n8n e aplicada em todos os HTTP Request nodes
- [ ] **Ação 1** — Curl com header retorna 200 (não 401)
- [ ] **Ação 1** — Fluxo real de confirmação WhatsApp funcionando
- [ ] **Ação 2** — `SUPABASE_SERVICE_ROLE_KEY` recriada como Sensitive
- [ ] **Ação 3** — Redeploy sem cache feito, status Ready
- [ ] **Bateria de testes** — todos os curls com resposta esperada
- [ ] **Validação anamnese** — primeira anamnese pós-deploy com `signature_country` e UA preenchidos

Quando essa lista estiver toda marcada, a infra de hardening da sessão
de hoje está oficialmente fechada e em produção.
