# TODO - Próximas Tarefas

## 🔴 PRIORIDADE ALTA: Ambiente de Staging

Antes de vender, precisa configurar ambiente separado para desenvolvimento/testes.

### Passos:

1. **Criar banco Supabase de staging**
   - Acesse: https://supabase.com/dashboard
   - Clique "New Project" → Nome: `cliniq-staging`
   - Anote as chaves (URL, anon key, service role key)

2. **Copiar schema para staging**
   - Use o guia em: `scripts/setup-staging.md`

3. **Configurar Vercel**
   - Criar branch `staging` no Git
   - Adicionar variáveis de ambiente com escopo "Preview"

4. **Testar**
   - Deploy staging funcionando
   - Dados de teste no banco staging

---

## 🟡 MELHORIAS PENDENTES

- [ ] Afinar Donna (IA WhatsApp) - consultar ferramentas corretamente
- [ ] Configurar monitoramento de erros (Sentry)
- [ ] Backup automático do banco

---

## ✅ CONCLUÍDO HOJE

- [x] Remover admin da lista de profissionais na agenda
- [x] Melhorar dashboard com gráfico semanal
- [x] Traduzir atividades para português
- [x] Documentar setup de staging

---

## 📝 NOTAS

- Guia completo de staging: `scripts/setup-staging.md`
- Convenções de código: `docs/NAMING-CONVENTIONS.md`
- Análise do banco: `docs/DATABASE-ANALYSIS.md`
- Indexes de performance: `docs/indexes-performance.sql`

---

Boa noite! 🌙
