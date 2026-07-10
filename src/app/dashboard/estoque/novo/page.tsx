import BackButton from '@/components/ui/BackButton'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProductForm from '../product-form'
import { getEffectiveAccess, can } from '@/lib/effective-permissions'

export default async function NovoProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const access = await getEffectiveAccess(supabase, user.id)
  if (!can(access, 'stock_edit')) redirect('/dashboard/estoque')

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton href="/dashboard/estoque" label="Estoque" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Novo Produto</h1>
        <p className="text-sm text-slate-500 mt-0.5">Adicione um produto ao estoque</p>
      </div>
      <ProductForm />
    </div>
  )
}
