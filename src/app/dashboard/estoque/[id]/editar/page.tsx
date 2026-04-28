import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import ProductForm from '../../product-form'

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!product) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Link href="/dashboard/estoque" className="hover:text-slate-700">Estoque</Link>
        <Icon name="chevronRight" className="w-4 h-4" />
        <Link href={`/dashboard/estoque/${product.id}`} className="hover:text-slate-700">{product.name}</Link>
        <Icon name="chevronRight" className="w-4 h-4" />
        <span className="text-slate-900">Editar</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Editar Produto</h1>
        <p className="text-sm text-slate-500 mt-0.5">Atualize as informações do produto</p>
      </div>

      <ProductForm
        product={{
          id: product.id,
          name: product.name || '',
          brand: product.brand || '',
          category: product.category || 'injetavel',
          unit: product.unit || 'unidade',
          min_stock: product.min_stock ?? 5,
          current_stock: product.current_stock ?? 0,
          cost_price: product.cost_price != null ? String(product.cost_price) : '',
          sale_price: product.sale_price != null ? String(product.sale_price) : '',
          expiry_date: product.expiry_date || '',
          batch_number: product.batch_number || '',
          supplier: product.supplier || '',
          notes: product.notes || '',
        }}
      />
    </div>
  )
}
