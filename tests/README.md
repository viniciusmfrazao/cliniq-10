# Testes Automatizados E2E - Clinike

Testes end-to-end usando **Playwright** que simulam usuários reais navegando pelo sistema.

## 📦 Instalação

```bash
# Instalar dependências do Playwright
npm install -D @playwright/test

# Instalar navegadores (Chromium, Firefox, WebKit)
npx playwright install
```

## 🚀 Como Executar

### Rodar Todos os Testes
```bash
npm run test:e2e
```

### Rodar com Interface Visual (UI Mode)
```bash
npm run test:e2e:ui
```

### Ver Relatório após os Testes
```bash
npm run test:e2e:report
```

### Rodar Testes Específicos
```bash
# Apenas testes de autenticação
npx playwright test auth.spec.ts

# Apenas testes de agenda
npx playwright test agenda.spec.ts

# Apenas testes do admin
npx playwright test admin.spec.ts
```

### Rodar em Modo Debug
```bash
npx playwright test --debug
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env.test` ou defina as variáveis:

```env
# Credenciais de usuário comum para testes
TEST_EMAIL=teste@clinike.com
TEST_PASSWORD=senha123

# Credenciais de super admin
SUPER_ADMIN_EMAIL=admin@clinike.com
SUPER_ADMIN_PASSWORD=senha123

# URL base (opcional, padrão: http://localhost:3000)
BASE_URL=http://localhost:3000
```

### Testar em Produção/Staging
```bash
# Testar no staging
BASE_URL=https://clinike-staging.vercel.app npx playwright test

# Testar em produção (cuidado!)
BASE_URL=https://clinike.com.br npx playwright test
```

## 📁 Estrutura dos Testes

```
tests/e2e/
├── auth.spec.ts           # Login, logout, permissões
├── agenda.spec.ts         # Agendamentos
├── pacientes.spec.ts      # CRUD de pacientes
├── financeiro.spec.ts     # Entradas, saídas, DRE
├── crm.spec.ts            # Leads e funil
├── admin.spec.ts          # Super Admin
└── fluxos-completos.spec.ts  # Jornadas completas
```

## 📊 Módulos Testados

| Módulo | Arquivo | Status |
|--------|---------|--------|
| Autenticação | auth.spec.ts | ✅ |
| Agenda | agenda.spec.ts | ✅ |
| Pacientes | pacientes.spec.ts | ✅ |
| Financeiro | financeiro.spec.ts | ✅ |
| CRM | crm.spec.ts | ✅ |
| Super Admin | admin.spec.ts | ✅ |
| Fluxos E2E | fluxos-completos.spec.ts | ✅ |

## 🔧 Comandos Úteis

```bash
# Gerar código de teste automaticamente (gravador)
npx playwright codegen http://localhost:3000

# Rodar em modo headless (sem interface)
npx playwright test --headed=false

# Rodar só em Chrome
npx playwright test --project=chromium

# Rodar com paralelismo desabilitado
npx playwright test --workers=1

# Atualizar snapshots
npx playwright test --update-snapshots
```

## 🎬 Gravador de Testes

O Playwright tem um gravador que gera código automaticamente:

```bash
npx playwright codegen http://localhost:3000
```

1. Uma janela do navegador abre
2. Você navega e clica normalmente
3. O código do teste é gerado automaticamente

## 📸 Screenshots e Vídeos

Em caso de falha, os testes geram automaticamente:
- Screenshots: `test-results/*/test-failed-1.png`
- Vídeos: `test-results/*/video.webm`
- Traces: `test-results/*/trace.zip`

Para ver o trace:
```bash
npx playwright show-trace test-results/auth-login/trace.zip
```

## 🔄 CI/CD

Para rodar no CI (GitHub Actions), adicione:

```yaml
# .github/workflows/tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## ❓ Troubleshooting

### Erro: "Cannot find module '@playwright/test'"
```bash
npm install -D @playwright/test
```

### Erro: "Executable doesn't exist"
```bash
npx playwright install
```

### Testes muito lentos
- Verifique se `npm run dev` está rodando
- Use `--workers=4` para paralelismo
- Verifique conexão com o banco

### Testes falhando por timeout
- Aumente o timeout em `playwright.config.ts`
- Verifique se os seletores estão corretos
- Use o modo debug: `npx playwright test --debug`
