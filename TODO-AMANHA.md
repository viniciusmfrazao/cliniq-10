# TODO - Tarefas Organizadas

## 🟢 PRÓXIMA: Integração Google Calendar
- [ ] Criar projeto no Google Cloud Console
- [ ] Habilitar Calendar API
- [ ] Configurar OAuth2 credentials
- [ ] Implementar flow de conexão nas configurações da clínica
- [ ] Ao agendar com paciente que tem email → criar evento no Google Calendar
- [ ] Paciente recebe convite automático por email
- **Tempo estimado:** ~2 horas

---

## 🔵 CONCLUÍDO - Site Institucional

### 1. Criar Site de Vendas do Clinike
- [ ] Usar o prompt em `docs/PROMPT-SITE-INSTITUCIONAL.md`
- [ ] Gerar código com Claude
- [ ] Tirar screenshots do sistema para usar no site
- [ ] Configurar WhatsApp: **34991805722**
- [ ] Deploy do site (Vercel)

---

## 🔴 PRIORIDADE ALTA: Ambiente de Staging

Antes de vender, precisa configurar ambiente separado para desenvolvimento/testes.

### Passos:

1. **Criar banco Supabase de staging**
   - Acesse: https://supabase.com/dashboard
   - Clique "New Project" → Nome: `clinike-staging`
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
- [ ] PWA para acesso mobile como app

---

## ✅ CONCLUÍDO ONTEM

- [x] Remover admin da lista de profissionais na agenda
- [x] Melhorar dashboard com gráfico semanal
- [x] Traduzir atividades para português
- [x] Soft delete para equipe (preserva histórico)
- [x] Indexes de performance no banco
- [x] Documentar convenções de nomenclatura
- [x] Centralizar tipos TypeScript
- [x] Documentar setup de staging

---

## 📝 ARQUIVOS IMPORTANTES

| Arquivo | Descrição |
|---------|-----------|
| `docs/PROMPT-SITE-INSTITUCIONAL.md` | Prompt para gerar site de vendas |
| `scripts/setup-staging.md` | Guia de setup do ambiente staging |
| `docs/NAMING-CONVENTIONS.md` | Convenções de código |
| `docs/DATABASE-ANALYSIS.md` | Análise do banco de dados |
| `docs/indexes-performance.sql` | Indexes para performance |

---

## 📞 CONTATO COMERCIAL

WhatsApp: **34 99180-5722**
Link: https://wa.me/5534991805722

---

Atualizado em: 19/04/2026
