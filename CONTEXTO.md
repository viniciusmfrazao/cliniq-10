# Clinike — Contexto do Projeto

## Stack
- **Frontend:** Next.js (Vercel) — app.clinike.com.br
- **Banco:** Supabase
- **WhatsApp:** Evolution API
- **IA:** Anthropic Claude (Haiku 3.5)
- **Repo:** github.com/viniciusmfrazao/cliniq-10

## Ambientes

### PRODUÇÃO
- URL: app.clinike.com.br
- Branch Git: main
- Supabase: yqrjbyaucimvmzpfipgs
- Clínica real: 182d37af-5b4f-4077-8223-020a8d44abb5
- Clínica teste: 6a718c1d-9a79-4e80-ad71-1c5c8a2ea190

### STAGING
- URL: teste.clinike.com.br
- Branch Git: staging
- Supabase: folcgzoxfpelogspivot
- Login: viniciusmfrazao@gmail.com / teste123

## Fluxo de Trabalho
- **Feature nova:** branch staging → testa em teste.clinike.com.br → merge main
- **Bug urgente:** corrige direto na main

## Eva (Edge Function)
- Modelo: claude-haiku-4-5-20251001
- Custo: ~$1.40/dia
- Debounce: 15s
- Prompt: staticPrompt (cacheia 1h) + dynamicPrompt (por turno)
- Deploy: automático via GitHub Actions ao push em supabase/functions/

## MCP Supabase (conectar na nova janela)
- Produção: yqrjbyaucimvmzpfipgs
- Staging: folcgzoxfpelogspivot

## Comandos iniciais nova janela
```bash
cd /home/claude/cliniq-10
git pull
git checkout staging  # features novas
git checkout main     # bugs urgentes
```

## Credenciais
- Ficam no 1Password / com o Vinicius
- NÃO commitar tokens no repositório
