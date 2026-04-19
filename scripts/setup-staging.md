# Setup do Ambiente de Staging

## Pré-requisitos
- Conta Supabase com 2 projetos (produção + staging)
- Conta Vercel

---

## Passo 1: Criar Projeto Supabase para Staging

1. Acesse https://supabase.com/dashboard
2. Clique em "New Project"
3. Preencha:
   - **Organization:** Sua organização
   - **Name:** clinike-staging
   - **Database Password:** (gere uma senha forte)
   - **Region:** South America (São Paulo) - mesma da produção
4. Aguarde a criação (~2 minutos)

---

## Passo 2: Copiar Schema da Produção para Staging

### Opção A: Via Supabase Dashboard (Mais Fácil)

1. No projeto de **PRODUÇÃO**, vá em: Database → Backups
2. Clique em "Download backup"
3. No projeto de **STAGING**, vá em: SQL Editor
4. Execute o SQL do backup (apenas estrutura, sem dados sensíveis)

### Opção B: Via SQL Manual

No **SQL Editor do Staging**, execute todo o conteúdo do arquivo:
`docs/super-admin-setup.sql`

E depois crie as tabelas principais executando as migrations.

### Opção C: Via Supabase CLI (Recomendado para devs)

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto de produção
supabase link --project-ref SEU_PROJECT_REF_PRODUCAO

# Fazer dump do schema (sem dados)
supabase db dump --schema public -f schema.sql

# Linkar projeto de staging
supabase link --project-ref SEU_PROJECT_REF_STAGING

# Restaurar schema no staging
supabase db push
```

---

## Passo 3: Criar Deploy de Staging no Vercel

1. Acesse https://vercel.com/dashboard
2. Selecione o projeto clinike-10
3. Vá em **Settings → Git**
4. Em "Production Branch", mantenha `main`

### Criar Branch de Staging

No terminal:
```bash
git checkout -b staging
git push -u origin staging
```

### Configurar Preview Environment no Vercel

1. Em **Settings → Environment Variables**
2. Adicione as variáveis de STAGING com escopo "Preview":

| Variável | Valor | Escopo |
|----------|-------|--------|
| NEXT_PUBLIC_SUPABASE_URL | https://SEU-PROJETO-STAGING.supabase.co | Preview |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJ... (do staging) | Preview |
| SUPABASE_SERVICE_ROLE_KEY | eyJ... (do staging) | Preview |

3. As variáveis de PRODUÇÃO ficam com escopo "Production"

---

## Passo 4: Fluxo de Trabalho

### Desenvolvimento (sua máquina)
```bash
# Criar branch para nova feature
git checkout staging
git pull origin staging
git checkout -b feature/minha-feature

# Desenvolver e testar localmente
npm run dev

# Commitar
git add .
git commit -m "feat: minha nova feature"
git push -u origin feature/minha-feature
```

### Testar em Staging
```bash
# Mergear na branch staging
git checkout staging
git merge feature/minha-feature
git push origin staging
```

A Vercel criará automaticamente um deploy preview em:
`https://clinike-10-git-staging-SEU-USUARIO.vercel.app`

### Promover para Produção
Após testar e aprovar:
```bash
git checkout main
git merge staging
git push origin main
```

---

## Passo 5: Configurar .env.local para Desenvolvimento

Crie um arquivo `.env.local` (não commitado):

```env
# STAGING (desenvolvimento local)
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO-STAGING.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...staging
SUPABASE_SERVICE_ROLE_KEY=eyJ...staging

# Outras variáveis
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Resumo dos Ambientes

| Ambiente | Branch | URL | Banco |
|----------|--------|-----|-------|
| **Local** | qualquer | localhost:3000 | Staging |
| **Staging** | staging | clinike-staging.vercel.app | Staging |
| **Produção** | main | clinike-10.vercel.app | Produção |

---

## Dados de Teste para Staging

Após configurar o banco de staging, crie dados de teste:

```sql
-- Criar clínica de teste
INSERT INTO clinics (name, slug, plan) 
VALUES ('Clínica Teste', 'clinica-teste', 'enterprise');

-- Criar usuário admin de teste
-- (use o Super Admin para criar via interface)
```

---

## Checklist Final

- [ ] Projeto Supabase de staging criado
- [ ] Schema copiado para staging
- [ ] Branch `staging` criada no Git
- [ ] Variáveis de ambiente configuradas na Vercel (Preview = staging)
- [ ] .env.local configurado para desenvolvimento local
- [ ] Dados de teste inseridos no banco staging
- [ ] Testou deploy de staging funcionando
