import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import StockMovementForm from './stock-movement-form'
import MovementHistory from './movement-history'

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
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

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('*, users(name), patients(name)')
    .eq('product_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const getStockStatus = () => {
    if (product.current_stock === 0) return { color: 'from-red-500 to-orange-500', label: 'Zerado', shadow: 'shadow-red-200' }
    if (product.current_stock <= product.min_stock) return { color: 'from-amber-500 to-yellow-500', label: 'Baixo', shadow: 'shadow-amber-200' }
    return { color: 'from-emerald-500 to-green-500', label: 'OK', shadow: 'shadow-emerald-200' }
  }

  const stockStatus = getStockStatus()

  const expiryDays = product.expiry_date 
    ? Math.ceil((new Date(product.expiry_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Link href="/dashboard/estoque" className="hover:text-slate-700">Estoque</Link>
        <Icon name="chevronRight" className="w-4 h-4" />
        <span className="text-slate-900">{product.name}</span>
      </div>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${stockStatus.color} flex items-center justify-center shadow-lg ${stockStatus.shadow} flex-shrink-0`}>
            <Icon name={product.category === 'injetavel' ? 'syringe' : 'box'} className="w-10 h-10 text-white" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
                <p className="text-slate-500 mt-1">
                  {product.brand || 'Sem marca'} • {product.category} • {product.unit}
                </p>
              </div>
              <Link
                href={`/dashboard/estoque/${product.id}/editar`}
                className="btn-secondary flex items-center gap-2"
              >
                <Icon name="edit" className="w-4 h-4" />
                Editar
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase font-medium">Estoque</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{product.current_stock}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gradient-to-r ${stockStatus.color} text-white`}>
                  {stockStatus.label}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase font-medium">Minimo</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{product.min_stock}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase font-medium">Custo</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {product.cost_price ? `R$ ${product.cost_price}` : '-'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase font-medium">Venda</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {product.sale_price ? `R$ ${product.sale_price}` : '-'}
                </p>
              </div>
            </div>

            {/* Validade e Lote */}
            {(product.expiry_date || product.batch_number) && (
              <div className="flex gap-4 mt-4">
                {product.batch_number && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Icon name="box" className="w-4 h-4" />
                    Lote: {product.batch_number}
                  </div>
                )}
                {product.expiry_date && (
                  <div className={`flex items-center gap-2 text-sm ${
                    expiryDays !== null && expiryDays < 0 ? 'text-red-600' :
                    expiryDays !== null && expiryDays <= 30 ? 'text-amber-600' : 'text-slate-600'
                  }`}>
                    <Icon name="clock" className="w-4 h-4" />
                    Validade: {new Date(product.expiry_date).toLocaleDateString('pt-BR')}
                    {expiryDays !== null && expiryDays < 0 && ' (Vencido)'}
                    {expiryDays !== null && expiryDays >= 0 && expiryDays <= 30 && ` (${expiryDays} dias)`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Movimentacao */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Movimentar Estoque</h2>
          <StockMovementForm product={product} />
        </div>

        {/* Historico */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Historico de Movimentacoes</h2>
          <MovementHistory movements={movements || []} clinicId={product.clinic_id} />
        </div>
      </div>
    </div>
  )
}

