# Clinike UI Auditor
# Roda antes de qualquer deploy para garantir consistência visual e evitar quebras

## Como usar
# Cole no terminal na raiz do projeto:
# npx ts-node scripts/ui-audit.ts
# Ou peça ao Claude: "rode o ui-audit no Clinike"

---

## REGRAS DO CLINIKE

### ✅ COMPONENTES OBRIGATÓRIOS (nunca substitua por genéricos)

| Em vez de | Use |
|-----------|-----|
| `<div className="animate-spin...">` manual | `<LoadingSpinner />` de `@/components/ui/LoadingSpinner` |
| `toast(...)` do sonner/react-hot-toast | `useToast()` de `@/components/ui/Toast` |
| `window.confirm(...)` | Modal com botões de confirmação |
| `<span className="...">` para ícones SVG inline | `<Icon name="..." />` de `@/components/ui/Icon` |
| `<input>` sem `<label>` | Sempre par label + input |

### ✅ CLASSES CSS OBRIGATÓRIAS (definidas em globals.css)

```
Botão primário:    btn btn-primary
Botão secundário:  btn btn-secondary  
Card:              card (nunca rounded-xl border shadow-sm manual)
Input:             input
Label:             label
Badge sucesso:     badge-success
Badge aviso:       badge-warning
Badge erro:        badge-error
Badge info:        badge-info
```

### ❌ NUNCA FAÇA

```tsx
// ❌ Spinner manual
<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
// ✅ Use
<LoadingSpinner size="sm" />

// ❌ Toast externo
import toast from 'sonner'
toast.success('...')
// ✅ Use
const { toast } = useToast()
toast({ title: '...', variant: 'success' })

// ❌ Botão sem classe padrão
<button className="px-4 py-2 bg-violet-600 text-white rounded-lg">
// ✅ Use
<button className="btn btn-primary">

// ❌ Card manual
<div className="rounded-xl border border-slate-200 shadow-sm p-4">
// ✅ Use
<div className="card p-4">

// ❌ Input sem label
<input type="text" placeholder="Nome" />
// ✅ Use
<label className="label">Nome</label>
<input className="input" type="text" placeholder="Nome" />

// ❌ Cores hardcoded
<div className="bg-violet-600 text-violet-700">
// ✅ Use variáveis CSS
<div style={{ background: 'var(--color-primary)' }}>
// ou as classes utilitárias do tema
```

### ✅ PADRÕES DE SEGURANÇA (evita quebrar o código)

1. **Auth**: Nunca chame `supabase.auth.getUser()` sem null check logo depois
   ```tsx
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) redirect('/login') // OBRIGATÓRIO
   ```

2. **API Routes com cookies**: Sempre exportar dynamic
   ```tsx
   export const dynamic = 'force-dynamic' // OBRIGATÓRIO em rotas que usam cookies()
   ```

3. **Server Components**: Nunca usar hooks (`useState`, `useEffect`) — apenas Client Components
   ```tsx
   'use client' // necessário se usar hooks
   ```

4. **Supabase client**: 
   - Server/middleware: `import { createClient } from '@/lib/supabase/server'`
   - Client: `import { createClient } from '@/lib/supabase/client'`
   - Nunca misturar os dois

5. **Deploy**: Sempre fazer "Promote to Production" manualmente no Vercel após commits críticos

6. **TypeScript**: Rodar `tsc --noEmit` antes de deploy de Edge Functions

### ✅ CHECKLIST PRÉ-DEPLOY

- [ ] Nenhum `window.confirm` no código
- [ ] Nenhum spinner manual (border-t-white animate-spin sem LoadingSpinner)
- [ ] Nenhum toast externo (sonner, react-hot-toast)
- [ ] Todo `getUser()` tem null check
- [ ] Toda API route com `cookies()` tem `export const dynamic = 'force-dynamic'`
- [ ] Nenhum `user!.id` sem null check antes
- [ ] Client e Server supabase não misturados
- [ ] Nenhuma classe de card/button/input manual em vez das classes padrão
- [ ] Todo input tem label associado
- [ ] Após deploy: verificar Vercel → "Promote to Production" se necessário
