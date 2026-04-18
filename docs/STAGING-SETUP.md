# Configuração do Ambiente de Staging

Este documento explica como configurar e usar o ambiente de staging para testar mudanças antes de ir para produção.

## Arquitetura

```
┌─────────────────┐     ┌─────────────────┐
│   PRODUÇÃO      │     │    STAGING      │
├─────────────────┤     ├─────────────────┤
│ Branch: main    │     │ Branch: staging │
│ URL: cliniq.app │     │ URL: staging-   │
│                 │     │   cliniq.app    │
│ Supabase: PROD  │     │ Supabase: STG   │
└─────────────────┘     └─────────────────┘
```

## Passo 1: Criar Projeto Staging no Supabase

1. Acesse [Supabase](https://supabase.com)
2. Crie um novo projeto: `cliniq-staging`
3. Copie as credenciais (URL, anon key, service key)

## Passo 2: Configurar Vercel

1. No [Vercel](https://vercel.com), vá em Settings > Git
2. Configure as branches:
   - `main` → Produção
   - `staging` → Preview

3. Vá em Settings > Environment Variables e adicione para **Preview**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO-STAGING.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_staging
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_staging
```

4. Opcional: Configure um domínio custom para staging:
   - `staging.cliniq.app` → branch staging

## Passo 3: Migrar Schema para Staging

Execute no SQL Editor do Supabase Staging todas as migrations:

1. Copie o schema do banco de produção
2. Execute no staging

Ou use a CLI do Supabase:

```bash
# Conectar ao projeto staging
supabase link --project-ref SEU_PROJECT_REF_STAGING

# Aplicar migrations
supabase db push
```

## Fluxo de Trabalho

### 1. Desenvolver Feature

```bash
# Criar branch a partir de staging
git checkout staging
git pull origin staging
git checkout -b feature/minha-feature

# Fazer as mudanças...
git add .
git commit -m "feat: minha nova feature"
git push origin feature/minha-feature
```

### 2. Testar no Staging

```bash
# Merge para staging
git checkout staging
git merge feature/minha-feature
git push origin staging
```

Vercel fará deploy automático para staging. Teste em `staging-cliniq.vercel.app`

### 3. Promover para Produção

Quando aprovado:

```bash
# Merge staging para main
git checkout main
git merge staging
git push origin main
```

## Comandos Úteis

```bash
# Ver em qual branch está
git branch

# Mudar para staging
git checkout staging

# Mudar para produção
git checkout main

# Atualizar staging com mudanças de main (se necessário)
git checkout staging
git merge main
git push origin staging
```

## Dados de Teste

Para staging, você pode:

1. **Seed automático**: Criar script de seed com dados fictícios
2. **Clone parcial**: Copiar apenas estrutura (sem dados reais de pacientes)
3. **Dados anonimizados**: Exportar dados de prod com nomes/telefones fictícios

## Checklist de Deploy

Antes de fazer merge de staging → main:

- [ ] Todas as features funcionando
- [ ] Nenhum erro de console
- [ ] Responsivo (mobile/desktop)
- [ ] Testes manuais dos fluxos principais
- [ ] Performance aceitável
- [ ] Migrations funcionam corretamente

## Rollback

Se algo der errado em produção:

```bash
# Reverter o último commit em main
git revert HEAD
git push origin main

# OU voltar para um commit específico
git reset --hard <commit-hash>
git push origin main --force  # CUIDADO!
```
