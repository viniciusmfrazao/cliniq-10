# Clinike — Contexto do Projeto

## Stack
- **Frontend:** Next.js (Vercel) — app.clinike.com.br
- **Banco:** Supabase
- **WhatsApp:** Evolution API
- **IA:** Anthropic Claude (Haiku 3.5)
- **Repo:** github.com/viniciusmfrazao/cliniq-10

## Credenciais / Acessos

### GitHub
- Token: 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
- Repo: viniciusmfrazao/cliniq-10

### Supabase PRODUÇÃO
- Project ref: yqrjbyaucimvmzpfipgs
- URL: https://yqrjbyaucimvmzpfipgs.supabase.co
- Clínica real: 182d37af-5b4f-4077-8223-020a8d44abb5 (Clinica Sarah Pina)
- Clínica teste: 6a718c1d-9a79-4e80-ad71-1c5c8a2ea190 (Clinika Sarah Pina Teste)

### Supabase STAGING
- Project ref: folcgzoxfpelogspivot
- URL: https://folcgzoxfpelogspivot.supabase.co
- Token: sbp_f93819273c8f0869fb6fdf770e8cf62d13da9754

### Vercel
- Produção: app.clinike.com.br (branch main)
- Staging: teste.clinike.com.br (branch staging)

### Anthropic
- Modelo atual: claude-haiku-4-5-20251001
- Custo estimado: ~$1.40/dia (era $5/dia com Sonnet)

## Fluxo de Trabalho
- **Feature nova:** branch staging → testa em teste.clinike.com.br → merge main
- **Bug urgente:** corrige direto na main
- **Deploy Eva:** automático via GitHub Actions ao push em supabase/functions/

## Estrutura da Eva (Edge Function)
- Arquivo principal: supabase/functions/eva-process/
- Prompt: separado em staticPrompt (cacheia 1h) + dynamicPrompt (por turno)
- Debounce: 15s
- Retries: não retenta 429/529

## Comandos úteis na nova janela
```bash
cd /home/claude/cliniq-10
git pull
git checkout staging  # para features
git checkout main     # para bugs urgentes
```

## MCP Supabase conectado
- Produção: yqrjbyaucimvmzpfipgs
- Staging: folcgzoxfpelogspivot
