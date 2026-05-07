# Clinike — Stress Test

Bateria de testes de stress profissionais usando [k6](https://k6.io)
(ferramenta open-source, padrão da indústria).

## 🎯 O que cobre

Os 3 cenários cobrem **capacidade**, **performance**, **gargalos** e
**sobrevivência a picos** simulando uma clínica em operação real.

| # | Teste | Alvo | Risco | Tempo |
|---|---|---|---|---|
| **01** | Landing | `clinike.com.br` (estático CDN) | 🟢 Zero | 1-5 min |
| **02** | Sistema (público) | `app.clinike.com.br` (login, esqueci-senha) | 🟢 Zero | 1-3 min |
| **03** | Webhook WhatsApp | `/api/webhooks/evolution/[instance]` | 🔴 Cuidado | 1-3 min |

Cada teste tem 4 estágios:
- **`smoke`** (1 min): valida que tá tudo funcionando
- **`load`** (3 min): performance em uso normal
- **`stress`** (5 min): até onde aguenta antes de quebrar
- **`spike`** (2 min): pico súbito (campanha viral / tráfego pago)

---

## 🚀 Setup (uma vez só)

### 1. Instalar o k6

**Windows (PowerShell)**:
```powershell
winget install k6 --source winget
# OU
choco install k6
```

Verifica:
```powershell
k6 version
```

### 2. Configurar variáveis

Copia `env.example.ps1` pra `env.ps1` (esse não vai pro git):

```powershell
Copy-Item stress-test\env.example.ps1 stress-test\env.ps1
notepad stress-test\env.ps1
```

Edita os valores. As principais:
- `LANDING_URL` (deixa default)
- `SYSTEM_URL` (deixa default)
- `WEBHOOK_INSTANCE` e `WEBHOOK_TOKEN` (só pra teste 03)

### 3. Carregar variáveis na sessão

```powershell
. .\stress-test\env.ps1
```
> ⚠️ O ponto+espaço no início (`. `) é o que importa as variáveis pra
> sua sessão atual do PowerShell. Sem isso, não funciona.

---

## 🏃 Como rodar

### Opção A — Runner orquestrador (recomendado)

```powershell
# Smoke completo (landing + sistema, sem webhook) — totalmente seguro
.\stress-test\run.ps1

# Load nos dois
.\stress-test\run.ps1 -Stage load

# Inclui webhook (REQUER instância de teste configurada)
.\stress-test\run.ps1 -Stage load -Webhook

# Só landing (campanha viral pra testar tráfego pago)
.\stress-test\run.ps1 -Stage spike -LandingOnly
```

### Opção B — k6 direto (mais controle)

```powershell
# Landing
k6 run stress-test\01-landing.js
k6 run --env STAGE=load   stress-test\01-landing.js
k6 run --env STAGE=spike  stress-test\01-landing.js

# Sistema
k6 run stress-test\02-system.js
k6 run --env STAGE=stress stress-test\02-system.js

# Webhook (CUIDADO — leia SAFETY.md antes)
k6 run stress-test\03-webhook.js                          # smoke (seguro)
k6 run --env STAGE=load --env FORCE=true stress-test\03-webhook.js
```

---

## 📊 Como interpretar os resultados

Ao final, o k6 imprime um **sumário customizado** com as métricas-chave
+ o sumário padrão. Procure:

### Status verde ✅
```
✓ http_req_failed.....: rate<0.01     (rodou 0.05% de erro)
✓ http_req_duration...: p(95)<500     (p95 ficou em 287ms)
```
**Significa**: o sistema aguenta esse nível de carga sem quebrar.

### Status vermelho ❌
```
✗ http_req_failed.....: rate<0.01     (rodou 3.2% de erro!)
```
**Significa**: na carga testada, o sistema começa a falhar. Reduza
o estágio ou identifique o gargalo (logs do Vercel, métricas Supabase).

### Métricas que importam

| Métrica | Bom | Ruim | O que indica |
|---|---|---|---|
| **p50** | <200ms | >500ms | Latência mediana — experiência do usuário típico |
| **p95** | <500ms | >2000ms | Latência do 5% pior (vai sentir lentidão às vezes) |
| **p99** | <1500ms | >5000ms | Casos extremos (vai parecer travado pra alguns) |
| **Throughput** | aumenta | flat ou cai | Quantas req/s consegue servir |
| **Error rate** | <1% | >5% | Sistema quebrando sob carga |

---

## 🔒 Segurança

**LEIA `SAFETY.md` antes de rodar o teste 03 (webhook).**

Resumo:
- Teste 01 e 02: **rodar à vontade** contra produção
- Teste 03: **só com instância Evolution de TESTE** ou Eva desligada;
  o teste cria leads e dispara mensagens pelo WhatsApp.

---

## 📁 Estrutura

```
stress-test/
├── 01-landing.js       — testa clinike.com.br
├── 02-system.js        — testa app.clinike.com.br (público)
├── 03-webhook.js       — testa webhook WhatsApp
├── run.ps1             — runner pra Windows
├── env.example.ps1     — template de variáveis
├── env.ps1             — suas variáveis (gitignored)
├── README.md           — este arquivo
├── SAFETY.md           — guia de segurança e limpeza
├── lib/
│   └── data.js         — geradores de dados sintéticos
└── results/            — output dos testes (gitignored)
```

---

## 🩺 Cenários reais sugeridos

### "Vou rodar uma campanha de tráfego pago amanhã"
```powershell
.\stress-test\run.ps1 -Stage spike -LandingOnly
```
Simula 800 visitantes simultâneos chegando da campanha. Se passar verde,
sua landing aguenta o pico.

### "Quero saber se aguenta 50 secretárias logando ao mesmo tempo"
```powershell
.\stress-test\run.ps1 -Stage load -SystemOnly
```
50 conexões simultâneas no `/login`. Bom indicador de capacidade do Next.js
+ Supabase pra autenticação.

### "Quero saber até onde a Eva escala"
```powershell
. .\stress-test\env.ps1
.\stress-test\run.ps1 -Stage stress -Webhook -Force
```
Dispara 50 mensagens/s no webhook. Cuidado com custo Claude API.

---

## 🐛 Troubleshooting

**Erro: "k6 nao encontrado"**
→ Instale via `winget install k6` ou veja https://k6.io/docs/get-started/installation/

**Erro: "missing env" no teste 03**
→ Carregue env.ps1 com `. .\stress-test\env.ps1`

**Erro: "confirmation needed" no teste 03 com STAGE!=smoke**
→ Adicione `--env FORCE=true` (confirma que você entende os custos)

**Performance horrível em casa**
→ Pode ser o WiFi/conexão. Rode de uma máquina com banda decente. Os
testes pesados (spike de 800 users) precisam de ~50Mbps de upload.
