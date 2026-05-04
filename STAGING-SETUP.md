# 🧪 Setup do ambiente de staging — `teste.clinike.com.br`

> Guia completo passo a passo. Tempo total: ~1h30 (depois de pronto, é pra sempre).

---

## 🎯 O que vai virar isso

```
PRODUÇÃO                            STAGING
app.clinike.com.br        ↔        teste.clinike.com.br
└─ Vercel: cliniq-10              └─ Vercel: cliniq-staging
└─ Supabase: yqrjbyaucim..        └─ Supabase: folcgzoxfpel..
└─ Branch git: main               └─ Branch git: staging
```

Isolamento total. Você quebra o staging à vontade, prod nunca é afetada.

---

## ✅ Etapa 1 — Schema do banco

**Pronto pra rodar.** Abra o SQL Editor do staging:
https://supabase.com/dashboard/project/folcgzoxfpelogspivot/sql/new

Cola o conteúdo de `scripts/staging-bootstrap.sql` INTEIRO e clica em **Run**.

O script é idempotente (pode rodar várias vezes), e faz:
- cria 3 enums novos (`module_name`, `plan_name`, `subscription_status`)
- cria 19 tabelas que faltam (clinic_whatsapp, app_settings, nps_responses, etc.)
- adiciona colunas em 9 tabelas existentes (leads, eva_conversations, etc.)
- cria 8 funções (donna_load_context, phone_variants, etc.)
- cria 5 views (eva_followup_queue, admin_metrics, etc.)
- cria 3 storage buckets (whatsapp-media, patient-photos, clinic-logos)
- aplica RLS em todas as tabelas novas
- popula seed básico (planos, app_settings)

Ao final, mostra uma tabelinha de verificação. Esperado: ~46 tabelas, 5 views, 11 enums, 15+ funções.

---

## ✅ Etapa 2 — Branch git `staging`

Rodar uma vez no PowerShell, na pasta do projeto:

```powershell
git checkout -b staging
git push -u origin staging
git checkout main
```

A partir daí: features novas vão pra branch `staging` primeiro.
Quando estiver bom, merge `staging` → `main` (vira prod).

---

## ✅ Etapa 3 — Vercel: novo projeto

1. https://vercel.com/dashboard → **Add New** → **Project**
2. **Import Git Repository** → escolhe o `cliniq-10` (mesmo repo da prod)
3. Project Name: `cliniq-staging`
4. **Build & Output Settings**:
   - Framework: Next.js (autodetecta)
   - Production Branch: **`staging`** (em "Settings → Git" se necessário)
5. **Environment Variables** — preencha todas (ver Etapa 4 abaixo) **antes** do primeiro Deploy
6. Deploy

---

## ✅ Etapa 4 — Environment Variables

Configure essas variáveis no novo projeto Vercel `cliniq-staging`. Marcar todas pra `Production`, `Preview` e `Development`.

### 🔑 Variáveis OBRIGATÓRIAS — vão DIFERIR da prod

| Nome | Valor pro staging | Onde pegar |
|------|-------------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://folcgzoxfpelogspivot.supabase.co` | Supabase staging → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key do staging>` | Supabase staging → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service role do staging>` | Supabase staging → Settings → API |
| `NEXT_PUBLIC_SITE_URL` | `https://teste.clinike.com.br` | Você mesmo |
| `NEXT_PUBLIC_APP_URL` | `https://teste.clinike.com.br` | Você mesmo |
| `CRON_SECRET` | `<gera novo random 32 chars>` | `[guid]::NewGuid()` no PowerShell |

### 🔑 Variáveis OPCIONAIS — você pode reusar da prod (com cuidado)

| Nome | O que faz | Recomendação |
|------|-----------|--------------|
| `ANTHROPIC_API_KEY` | Eva (Claude) | **Reusa da prod** ou cria uma chave separada pra rastrear custos do staging |
| `RESEND_API_KEY` | Email transactional | **Reusa da prod** (volume baixo) |
| `EVOLUTION_API_URL` | WhatsApp | ⚠️ Veja **Caveat WhatsApp** abaixo |
| `EVOLUTION_API_KEY` | WhatsApp master key | ⚠️ Veja **Caveat WhatsApp** abaixo |

### ⚠️ Caveat WhatsApp / Evolution

A Evolution API tem **uma instância por número de WhatsApp**. O webhook só aponta pra **um** lugar (prod). Resultado:

- **Staging não recebe** webhooks reais do WhatsApp
- Se você criar uma instância nova no staging, ela funcionaria — mas iria gastar uma 2ª linha telefônica

**Como testar features de WhatsApp no staging sem 2ª linha:**

1. Usa o **stress-test/03-webhook.js** apontando pra staging — simula mensagens chegando
2. Deixa **toggle Eva OFF** no staging (já existe, recém-implementado)
3. Pra testar UI: cria leads/conversas via SQL ou na interface, sem precisar de webhook real

---

## ✅ Etapa 5 — Domínio `teste.clinike.com.br`

### 5.1 No Vercel staging (`cliniq-staging`)
1. **Settings** → **Domains** → **Add**
2. Digita `teste.clinike.com.br`
3. Vercel mostra um registro CNAME ou A pra criar (anota)

### 5.2 No Registro.br
1. Painel de DNS de `clinike.com.br`
2. Adiciona um **CNAME**:
   - Nome: `teste`
   - Tipo: `CNAME`
   - Valor: `cname.vercel-dns.com.` (ou o que o Vercel pediu)
3. Salva. Propagação: 5min a 24h (geralmente <30min)

### 5.3 Voltando ao Vercel
- Aguarda o ✅ verde aparecer em "Domains"
- SSL é automático

---

## ✅ Etapa 6 — Seed de dados iniciais (clinic + admin)

Pra conseguir logar no staging, precisa criar 1 clínica + 1 usuário admin. Passo a passo:

### 6.1 Criar usuário no Auth do Supabase
1. https://supabase.com/dashboard/project/folcgzoxfpelogspivot/auth/users
2. Clica em **Add user** → **Create new user**
3. Email: ex. `admin@clinike.com.br` (ou o que quiser)
4. Password: senha forte (anota — vai usar pra logar)
5. **IMPORTANTE**: marca ☑ **Auto Confirm User** (senão precisa email)
6. Create user
7. **Copia o UUID** que apareceu na lista (ex: `a1b2c3d4-...`)

### 6.2 Rodar o seed
1. Abre `scripts/staging-seed.sql`
2. **Edita as linhas 22-23**:
   - `v_admin_id` → cola o UUID que copiou
   - `v_admin_email` → mesmo email do passo 6.1
3. Cola tudo no SQL Editor do staging e roda

Resultado: 1 clínica "Clínica Teste Staging" + 1 admin + 3 procedimentos + 2 salas + automações default.

---

## ✅ Etapa 7 — Teste de fumaça

Quando tudo subir:
1. Acessa `https://teste.clinike.com.br`
2. Login com o admin do seed
3. Verifica:
   - Dashboard abre ✅
   - CRM abre, mostra lista vazia ✅
   - Toggle Eva no /dashboard/whatsapp aparece (mas não tem instância conectada) ✅
   - Cria um lead manual → aparece no Kanban ✅

Se tudo isso funcionar, o staging tá pronto.

---

## 📋 Workflow de desenvolvimento daqui pra frente

```
Feature nova:
1. git checkout staging
2. (faz mudanças)
3. git commit + git push origin staging
   → Vercel staging deploya em teste.clinike.com.br
4. Testa em teste.clinike.com.br
5. Tudo OK?
   → git checkout main && git merge staging && git push origin main
   → Vercel produção deploya em app.clinike.com.br

Hotfix urgente em prod:
1. git checkout main
2. (corrige)
3. git push origin main
   → vai direto pra prod
4. git checkout staging && git merge main
   → mantém staging sincronizado
```

---

## 🔄 Resincronizar dados do staging com a prod (futuro)

Se quiser zerar staging com dados frescos da prod:

```powershell
supabase db dump --linked --schema public --data-only -f prod-data.sql --project-ref yqrjbyaucimvmzpfipgs
# (cuidado: prod-data.sql contém dados reais; criptografe ou apague depois)
psql "<staging connection string>" -f prod-data.sql
```

Mas **não recomendo** fazer isso periodicamente — staging melhor com dados sintéticos pra evitar vazamento de PII.
