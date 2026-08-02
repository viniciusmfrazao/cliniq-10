'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import BodyMap, { BODY_VIEWBOX } from '@/components/ui/BodyMap'
import { createLogger } from '@/lib/logger'
import { todayBR } from '@/lib/datetime'
import { classifyBodyProcedureType, BODY_PROCEDURE_TYPES } from '@/lib/body-procedure-type'

const log = createLogger('BodyMap')

type Point = {
  id: string
  x: number
  y: number
  view: 'front' | 'back'
  zone: string
  product_id: string
  product_name: string
  units: number
}

type Product = {
  id: string
  name: string
  brand: string | null
  category: string | null
  current_stock: number
  unit: string
  batch_number: string | null
  expiry_date: string | null
}

type BodyApplication = {
  id: string
  total_units: number
  product_name?: string
  product_id: string | null
  procedure_type: string
  stock_deducted: boolean | null
  products: { name: string } | null
  body_points: Array<{ view: string; zone: string; x_position: number; y_position: number; units: number }>
}

type Props = {
  patient: { id: string; name: string; gender?: string | null }
  appointmentId: string
  products: Product[]
  currentBodyApplications: BodyApplication[]
  clinicId: string
}

const PRODUCT_COLORS = [
  '#8b5cf6', '#ec4899', '#f97316', '#10b981',
  '#3b82f6', '#ef4444', '#eab308', '#6366f1',
]

// Detecta a zona corporal a partir da posição (%) e da vista (frente/costas).
// É só um chute inicial — o profissional pode reclassificar depois se quiser
// (mesma filosofia do detectRegion do mapa facial).
function detectBodyZone(xPct: number, yPct: number, view: 'front' | 'back'): string {
  const isArm = xPct < 30 || xPct > 70

  if (yPct < 48) {
    if (isArm) return 'Braço'
    if (view === 'front') return yPct < 24 ? 'Tórax' : 'Abdômen'
    return yPct < 24 ? 'Costas superior' : 'Lombar'
  }

  if (view === 'front') {
    if (yPct < 68) return Math.abs(xPct - 50) < 8 ? 'Coxa interna' : 'Coxa externa'
    if (yPct < 90) return 'Perna'
    return 'Pé'
  }

  if (yPct < 53) return 'Glúteo'
  if (yPct < 90) return 'Coxa posterior'
  return 'Pé'
}

export default function BodyMapSection({ patient, appointmentId, products, currentBodyApplications, clinicId }: Props) {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [view, setView] = useState<'front' | 'back'>('front')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeProduct, setActiveProduct] = useState<string>('')
  const [unitsPerClick, setUnitsPerClick] = useState(1)
  const [isMarkingMode, setIsMarkingMode] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const productColorMap = new Map<string, string>()
  const getProductColor = (productId: string) => {
    if (!productColorMap.has(productId)) {
      productColorMap.set(productId, PRODUCT_COLORS[productColorMap.size % PRODUCT_COLORS.length])
    }
    return productColorMap.get(productId) || PRODUCT_COLORS[0]
  }

  const toSvgCoords = (x: number, y: number) => ({
    x: (x / 100) * BODY_VIEWBOX.w,
    y: (y / 100) * BODY_VIEWBOX.h,
  })

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMarkingMode || !activeProduct) return
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const product = products.find(p => p.id === activeProduct)
    if (!product) return
    const zone = detectBodyZone(x, y, view)
    const newPoint: Point = {
      id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      x, y, view, zone,
      product_id: activeProduct,
      product_name: product.name,
      units: unitsPerClick,
    }
    setPoints(prev => [...prev, newPoint])
  }

  const undoLastPoint = () => setPoints(prev => prev.slice(0, -1))
  const clearAllPoints = () => { if (points.length > 0 && confirm('Limpar todos os pontos?')) setPoints([]) }
  const removePoint = (id: string) => setPoints(prev => prev.filter(p => p.id !== id))

  const totalUnits = points.reduce((acc, p) => acc + p.units, 0)
  const productSummary = points.reduce((acc, p) => {
    if (!acc[p.product_id]) {
      acc[p.product_id] = { name: p.product_name, units: 0, points: 0, color: getProductColor(p.product_id) }
    }
    acc[p.product_id].units += p.units
    acc[p.product_id].points += 1
    return acc
  }, {} as Record<string, { name: string; units: number; points: number; color: string }>)

  const saveApplications = async () => {
    if (points.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const byProduct = points.reduce((acc, p) => {
        if (!acc[p.product_id]) acc[p.product_id] = []
        acc[p.product_id].push(p)
        return acc
      }, {} as Record<string, Point[]>)

      for (const [productId, productPoints] of Object.entries(byProduct)) {
        const product = products.find(p => p.id === productId)
        const totalProductUnits = productPoints.reduce((a, p) => a + p.units, 0)
        const procedureType = classifyBodyProcedureType(product?.name, product?.category)

        const { data: application, error: appError } = await supabase
          .from('body_applications')
          .insert({
            clinic_id: clinicId,
            patient_id: patient.id,
            appointment_id: appointmentId,
            product_id: productId,
            product_name: product?.name || 'Produto',
            product_brand: product?.brand || null,
            total_units: totalProductUnits,
            stock_deducted: false,
            application_date: todayBR(),
            procedure_type: procedureType,
          })
          .select()
          .single()

        if (appError) {
          setError(appError.message)
          throw new Error(appError.message)
        }

        await supabase.from('body_points').insert(
          productPoints.map(p => ({
            application_id: application.id,
            view: p.view,
            zone: p.zone,
            x_position: p.x,
            y_position: p.y,
            units: p.units,
          }))
        )
      }

      setPoints([])
      setIsMarkingMode(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      log.error('Falha ao salvar aplicações corporais', err)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const deleteApplication = async (app: BodyApplication) => {
    const name = app.product_name || app.products?.name || 'produto'
    if (!confirm(`Excluir aplicação de "${name}"? Se o estoque já tiver sido descontado, ele será estornado.`)) return
    setDeletingId(app.id)
    try {
      if (app.product_id && app.stock_deducted && (app.total_units || 0) > 0) {
        const { data: productData } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', app.product_id)
          .single()

        if (productData) {
          const { data: { user } } = await supabase.auth.getUser()
          const newStock = productData.current_stock + (app.total_units || 0)

          await supabase.from('stock_movements').insert({
            clinic_id: clinicId,
            product_id: app.product_id,
            type: 'entrada',
            quantity: app.total_units,
            previous_stock: productData.current_stock,
            new_stock: newStock,
            reason: 'Estorno por exclusão de aplicação corporal (atendimento)',
            appointment_id: appointmentId,
            patient_id: patient.id,
            user_id: user?.id,
          })
        }
      }

      await supabase.from('body_points').delete().eq('application_id', app.id)
      const { error } = await supabase.from('body_applications').delete().eq('id', app.id)
      if (error) throw error

      router.refresh()
    } catch (err) {
      log.error('Erro ao excluir aplicação corporal', err)
      alert('Erro ao excluir aplicação.')
    } finally {
      setDeletingId(null)
    }
  }

  const activeProductData = products.find(p => p.id === activeProduct)
  const procedureLabel = (value: string) => BODY_PROCEDURE_TYPES.find(t => t.value === value)?.label || value

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Mapa Corporal</h3>
          {points.length > 0 && (
            <span className="text-lg font-bold text-violet-600">{totalUnits}U</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Erro */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Toggle frente/costas */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit mx-auto">
          {(['front', 'back'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'front' ? 'Frente' : 'Costas'}
            </button>
          ))}
        </div>

        {/* Configuração do produto */}
        <div className="p-4 bg-slate-50 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Configurar aplicação</span>
            {isMarkingMode && (
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                Modo ativo
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Produto</label>
            {products.length === 0 ? (
              <p className="text-sm text-amber-600 p-2 bg-amber-50 rounded-lg">
                Cadastre produtos no estoque primeiro
              </p>
            ) : (
              <select
                value={activeProduct}
                onChange={e => setActiveProduct(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none"
              >
                <option value="">Selecione o produto...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.brand ? `(${p.brand})` : ''} - {p.current_stock} {p.unit || 'un'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {activeProduct && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Unidades por clique</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUnitsPerClick(Math.max(1, unitsPerClick - 1))}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-violet-300"
                >-</button>
                <span className="w-8 text-center text-sm font-bold text-slate-900">{unitsPerClick}</span>
                <button
                  onClick={() => setUnitsPerClick(unitsPerClick + 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-violet-300"
                >+</button>
              </div>
            </div>
          )}

          <button
            onClick={() => setIsMarkingMode(!isMarkingMode)}
            disabled={!activeProduct}
            className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              isMarkingMode
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : activeProduct
                ? 'bg-violet-600 hover:bg-violet-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isMarkingMode ? (
              <><Icon name="x" className="w-4 h-4" />Parar marcação</>
            ) : (
              <><Icon name="edit" className="w-4 h-4" />Iniciar marcação</>
            )}
          </button>
        </div>

        {activeProductData && isMarkingMode && (
          <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: getProductColor(activeProduct) }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-violet-900">{activeProductData.name}</p>
              <p className="text-xs text-violet-600">{unitsPerClick}U por clique · vista {view === 'front' ? 'frente' : 'costas'}</p>
            </div>
          </div>
        )}

        {/* Mapa */}
        <div className={`relative rounded-xl overflow-hidden ${isMarkingMode ? 'ring-2 ring-violet-500 ring-offset-2' : ''}`}>
          <div className="bg-gradient-to-b from-slate-50 to-slate-100 p-4">
            <BodyMap ref={svgRef} onClick={handleMapClick} showRegions={true} view={view}>
              {/* Pontos existentes (salvos) — só os da vista atual */}
              {currentBodyApplications.flatMap(app =>
                (app.body_points || [])
                  .filter(p => p.view === view)
                  .map((p, i) => {
                    const coords = toSvgCoords(p.x_position, p.y_position)
                    return (
                      <g key={`saved-${app.id}-${i}`}>
                        <circle cx={coords.x} cy={coords.y} r="8" fill="#64748b" stroke="white" strokeWidth="2" />
                        <text x={coords.x} y={coords.y + 3} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
                          {p.units}
                        </text>
                      </g>
                    )
                  })
              )}
              {/* Pontos novos (não salvos) — só os da vista atual */}
              {points.filter(p => p.view === view).map((point) => {
                const coords = toSvgCoords(point.x, point.y)
                const color = getProductColor(point.product_id)
                return (
                  <g key={point.id}>
                    <circle
                      cx={coords.x} cy={coords.y} r="10"
                      fill={color} stroke="white" strokeWidth="2"
                      className="cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); removePoint(point.id) }}
                    />
                    <text x={coords.x} y={coords.y + 4} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
                      {point.units}
                    </text>
                  </g>
                )
              })}
            </BodyMap>
          </div>

          {!isMarkingMode && products.length > 0 && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <p className="text-sm text-slate-500 font-medium">
                Selecione um produto e clique em &quot;Iniciar marcação&quot;
              </p>
            </div>
          )}
        </div>

        {/* Pontos marcados em ambas as vistas (contador, já que só uma vista aparece por vez) */}
        {points.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={undoLastPoint}
                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center gap-1"
              >
                <Icon name="arrowLeft" className="w-3 h-3" />Desfazer
              </button>
              <button
                onClick={clearAllPoints}
                className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
              >
                Limpar tudo
              </button>
            </div>
            <span className="text-xs text-slate-500">
              {points.length} ponto(s) · {points.filter(p => p.view !== view).length} na outra vista
            </span>
          </div>
        )}

        {/* Resumo por produto */}
        {Object.keys(productSummary).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Resumo</p>
            {Object.values(productSummary).map((prod, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: prod.color }} />
                  <span className="text-sm font-medium text-slate-700">{prod.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">{prod.units}U</span>
                  <span className="text-xs text-slate-500 ml-1">({prod.points} pts)</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alerta e botão salvar */}
        {points.length > 0 && (
          <>
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
              <Icon name="bell" className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-700">
                O estoque será descontado ao finalizar o atendimento
              </p>
            </div>
            <button
              onClick={saveApplications}
              disabled={saving}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <><Icon name="check" className="w-4 h-4" />Salvar {points.length} pontos ({totalUnits}U)</>
              )}
            </button>
          </>
        )}

        {/* Aplicações já salvas */}
        {currentBodyApplications.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Aplicações salvas</p>
            {currentBodyApplications.map(app => (
              <div key={app.id} className="flex items-center justify-between py-2 px-3 bg-emerald-50 rounded-lg mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                    {procedureLabel(app.procedure_type)}
                  </span>
                  <span className="text-sm text-emerald-700">
                    {app.product_name || app.products?.name || 'Produto'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-700">
                    {app.total_units}U ({app.body_points?.length || 0} pts)
                  </span>
                  <button
                    onClick={() => deleteApplication(app)}
                    disabled={deletingId === app.id}
                    className="p-1 hover:bg-red-100 rounded-md text-red-500 transition-colors disabled:opacity-50"
                    title="Excluir aplicação"
                  >
                    {deletingId === app.id
                      ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                      : <Icon name="trash" className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
