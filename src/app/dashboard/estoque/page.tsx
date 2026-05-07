import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import ProductList from './product-list'
import StockAlerts from './stock-alerts'
import { formatBRL, formatBRLCompact } from '@/lib/format'

export default async function EstoquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .eq('is_active', true)
    .order('name')

  const lowStock = products?.filter(p => p.current_stock <= p.min_stock) || []
  const expiringSoon = products?.filter(p => {
    if (!p.expiry_date) return false
    const days = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000)
    return days <= 30 && days > 0
  }) || []
  const expired = products?.filter(p => {
    if (!p.expiry_date) return false
    return new Date(p.expiry_date) < new Date()
  }) || []

  const totalValue = products?.reduce((acc, p) => acc + (p.current_stock * (p.cost_price || 0)), 0) || 0

  const CATEGORIES = [
    { id: 'all', label: 'Todos', icon: 'grid' },
    { id: 'injetavel', label: 'Injetaveis', icon: 'syringe' },
    { id: 'cosmetico', label: 'Cosmeticos', icon: 'sparkles' },
    { id: 'descartavel', label: 'Descartaveis', icon: 'box' },
    { id: 'equipamento', label: 'Equipamentos', icon: 'settings' },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Estoque</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controle de produtos e insumos</p>
        </div>
        <Link href="/dashboard/estoque/novo" className="btn-primary w-auto px-4 flex items-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          Novo Produto
        </Link>
      </div>

      {/* Alertas */}
      {(lowStock.length > 0 || expiringSoon.length > 0 || expired.length > 0) && (
        <StockAlerts lowStock={lowStock} expiringSoon={expiringSoon} expired={expired} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-3 md:p-4 min-w-0">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
              <Icon name="box" className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl md:text-2xl font-bold text-slate-900 truncate">{products?.length || 0}</p>
              <p className="text-xs text-slate-500 truncate">Produtos</p>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-4 min-w-0">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-200 flex-shrink-0">
              <Icon name="trending" className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl md:text-2xl font-bold text-slate-900 truncate">{lowStock.length}</p>
              <p className="text-xs text-slate-500 truncate">Estoque baixo</p>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-4 min-w-0">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-200 flex-shrink-0">
              <Icon name="clock" className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl md:text-2xl font-bold text-slate-900 truncate">{expiringSoon.length + expired.length}</p>
              <p className="text-xs text-slate-500 truncate">Vencendo</p>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-4 min-w-0">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
              <Icon name="dollar" className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base md:text-2xl font-bold text-slate-900 truncate" title={formatBRL(totalValue)}>
                <span className="md:hidden">{formatBRLCompact(totalValue)}</span>
                <span className="hidden md:inline">{formatBRL(totalValue)}</span>
              </p>
              <p className="text-xs text-slate-500 truncate">Valor em estoque</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Produtos */}
      <ProductList
        products={products || []}
        categories={CATEGORIES}
        clinicId={userData?.clinic_id || ''}
      />
    </div>
  )
}
