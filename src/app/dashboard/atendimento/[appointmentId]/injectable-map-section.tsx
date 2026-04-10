'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import FaceMap from '@/components/ui/FaceMap'
import { createLogger } from '@/lib/logger'

const log = createLogger('InjectableMap')

type Point = {
  id: string
  x: number
  y: number
  region: string
  product_id: string
  product_name: string
  units: number
}

type Product = {
  id: string
  name: string
  brand: string | null
  current_stock: number
  unit: string
  batch_number: string | null
  expiry_date: string | null
}

type Props = {
  patient: { id: string; name: string }
  appointmentId: string
  products: Product[]
  currentInjections: Array<{
    id: string
    total_units: number
    product_name?: string
    products: { name: string } | null
    injectable_points: Array<{ x: number; y: number; region: string; units: number }>
  }>
  clinicId: string
}

const PRODUCT_COLORS = [
  '#8b5cf6', '#ec4899', '#f97316', '#10b981', 
  '#3b82f6', '#ef4444', '#eab308', '#6366f1',
]

// Detectar região baseado na posição Y
const detectRegion = (y: number): string => {
  if (y < 20) return 'Testa'
  if (y < 30) return 'Glabela'
  if (y < 40) return 'Periorbital'
  if (y < 55) return 'Zigomático'
  if (y < 65) return 'Nasolabial'
  if (y < 75) return 'Lábios'
  if (y < 85) return 'Mandíbula'
  return 'Mento'
}

export default function InjectableMapSection({ patient, appointmentId, products, currentInjections, clinicId }: Props) {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Configuração atual (produto e unidades por clique)
  const [activeProduct, setActiveProduct] = useState<string>('')
  const [unitsPerClick, setUnitsPerClick] = useState(1)
  const [isMarkingMode, setIsMarkingMode] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Cores por produto
  const productColorMap = new Map<string, string>()
  const getProductColor = (productId: string) => {
    if (!productColorMap.has(productId)) {
      productColorMap.set(productId, PRODUCT_COLORS[productColorMap.size % PRODUCT_COLORS.length])
    }
    return productColorMap.get(productId) || PRODUCT_COLORS[0]
  }

  // Converter coordenadas
  const toSvgCoords = (x: number, y: number) => ({
    x: (x / 100) * 300,
    y: (y / 100) * 400
  })

  // Clique no mapa - adiciona ponto direto (sem modal)
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMarkingMode || !activeProduct) return
    if (!svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const product = products.find(p => p.id === activeProduct)
    if (!product) return

    const region = detectRegion(y)
    
    const newPoint: Point = {
      id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      x,
      y,
      region,
      product_id: activeProduct,
      product_name: product.name,
      units: unitsPerClick
    }

    setPoints(prev => [...prev, newPoint])
  }

  // Remover último ponto (Ctrl+Z)
  const undoLastPoint = () => {
    setPoints(prev => prev.slice(0, -1))
  }

  // Limpar todos os pontos
  const clearAllPoints = () => {
    if (points.length > 0 && confirm('Limpar todos os pontos?')) {
      setPoints([])
    }
  }

  // Remover ponto específico
  const removePoint = (id: string) => {
    setPoints(prev => prev.filter(p => p.id !== id))
  }

  // Totais
  const totalUnits = points.reduce((acc, p) => acc + p.units, 0)
  const productSummary = points.reduce((acc, p) => {
    if (!acc[p.product_id]) {
      acc[p.product_id] = { name: p.product_name, units: 0, points: 0, color: getProductColor(p.product_id) }
    }
    acc[p.product_id].units += p.units
    acc[p.product_id].points += 1
    return acc
  }, {} as Record<string, { name: string; units: number; points: number; color: string }>)

  // Salvar aplicações
  const saveInjections = async () => {
    if (points.length === 0) return
    
    setSaving(true)
    setError(null)
    
    console.log('=== INICIANDO SALVAMENTO ===')
    console.log('Pontos:', points.length)
    console.log('Clinic ID:', clinicId)
    console.log('Patient ID:', patient.id)
    console.log('Appointment ID:', appointmentId)

    try {
      // Agrupar por produto
      const byProduct = points.reduce((acc, p) => {
        if (!acc[p.product_id]) acc[p.product_id] = []
        acc[p.product_id].push(p)
        return acc
      }, {} as Record<string, Point[]>)

      console.log('Produtos agrupados:', Object.keys(byProduct).length)

      for (const [productId, productPoints] of Object.entries(byProduct)) {
        const product = products.find(p => p.id === productId)
        const totalProductUnits = productPoints.reduce((a, p) => a + p.units, 0)

        console.log('Salvando produto:', product?.name, 'Units:', totalProductUnits)

        const insertData = {
          clinic_id: clinicId,
          patient_id: patient.id,
          appointment_id: appointmentId,
          product_id: productId,
          product_name: product?.name || 'Produto',
          product_brand: product?.brand || null,
          total_units: totalProductUnits,
          stock_deducted: false,
          application_date: new Date().toISOString().split('T')[0],
          type: 'botox'
        }

        console.log('Dados para inserir:', JSON.stringify(insertData, null, 2))

        // Criar aplicação
        const { data: application, error: appError } = await supabase
          .from('injectable_applications')
          .insert(insertData)
          .select()
          .single()

        if (appError) {
          console.error('=== ERRO AO SALVAR APLICAÇÃO ===')
          console.error('Código:', appError.code)
          console.error('Mensagem:', appError.message)
          console.error('Detalhes:', appError.details)
          console.error('Hint:', appError.hint)
          
          const errorMsg = `ERRO: ${appError.code} - ${appError.message}\nDetalhes: ${appError.details || 'N/A'}\nDica: ${appError.hint || 'N/A'}`
          setError(errorMsg)
          alert(errorMsg)
          throw new Error(errorMsg)
        }

        console.log('=== APLICAÇÃO CRIADA ===', application?.id)

        // Criar pontos
        const pointsData = productPoints.map(p => ({
          application_id: application.id,
          x: p.x,
          y: p.y,
          region: p.region,
          units: p.units
        }))

        const { error: pointsError } = await supabase
          .from('injectable_points')
          .insert(pointsData)

        if (pointsError) {
          log.error('Erro ao criar pontos na tabela injectable_points', pointsError, {
            applicationId: application.id,
            numPoints: pointsData.length,
            errorCode: pointsError.code,
            errorDetails: pointsError.details,
            errorHint: pointsError.hint
          })
          throw new Error(`Erro ao salvar pontos: ${pointsError.message}`)
        }

        log.info('Pontos criados com sucesso', { 
          applicationId: application.id,
          numPoints: pointsData.length 
        })
      }

      log.info('Todas as aplicações salvas com sucesso')
      setPoints([])
      setIsMarkingMode(false)
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao salvar aplicações'
      log.error('Falha ao salvar aplicações', err, {
        appointmentId,
        patientId: patient.id,
        totalPoints: points.length
      })
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const activeProductData = products.find(p => p.id === activeProduct)

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Mapa de Injetáveis</h3>
            <p className="text-xs text-slate-500">
              {isMarkingMode ? 'Clique no rosto para adicionar pontos' : 'Configure e ative o modo de marcação'}
            </p>
          </div>
          {points.length > 0 && (
            <span className="text-lg font-bold text-violet-600">
              {totalUnits}U
            </span>
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

          {/* Seletor de Produto */}
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
                disabled={isMarkingMode && points.length > 0}
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

          {/* Unidades por clique */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Unidades por ponto</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setUnitsPerClick(n)}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                    unitsPerClick === n 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-violet-300'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min="1"
                value={unitsPerClick}
                onChange={e => setUnitsPerClick(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-10 px-2 bg-white border border-slate-200 rounded-lg text-sm text-center font-semibold focus:border-violet-500 outline-none"
              />
            </div>
          </div>

          {/* Botão de modo */}
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
              <>
                <Icon name="x" className="w-4 h-4" />
                Parar marcação
              </>
            ) : (
              <>
                <Icon name="edit" className="w-4 h-4" />
                Iniciar marcação
              </>
            )}
          </button>
        </div>

        {/* Info do produto ativo */}
        {activeProductData && isMarkingMode && (
          <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
            <span 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: getProductColor(activeProduct) }}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-violet-900">{activeProductData.name}</p>
              <p className="text-xs text-violet-600">{unitsPerClick}U por clique</p>
            </div>
          </div>
        )}

        {/* Mapa */}
        <div className={`relative rounded-xl overflow-hidden ${
          isMarkingMode ? 'ring-2 ring-violet-500 ring-offset-2' : ''
        }`}>
          <div className="bg-gradient-to-b from-slate-50 to-slate-100 p-4">
            <FaceMap 
              ref={svgRef} 
              onClick={handleMapClick} 
              showRegions={true}
            >
              {/* Pontos existentes (salvos) */}
              {currentInjections.flatMap(inj => 
                inj.injectable_points?.map((p, i) => {
                  const coords = toSvgCoords(p.x, p.y)
                  return (
                    <g key={`saved-${inj.id}-${i}`}>
                      <circle 
                        cx={coords.x} 
                        cy={coords.y} 
                        r="8" 
                        fill="#64748b" 
                        stroke="white" 
                        strokeWidth="2"
                      />
                      <text x={coords.x} y={coords.y + 3} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
                        {p.units}
                      </text>
                    </g>
                  )
                })
              )}

              {/* Pontos novos (não salvos) */}
              {points.map((point) => {
                const coords = toSvgCoords(point.x, point.y)
                const color = getProductColor(point.product_id)
                return (
                  <g key={point.id}>
                    <circle 
                      cx={coords.x} 
                      cy={coords.y} 
                      r="10" 
                      fill={color}
                      stroke="white" 
                      strokeWidth="2"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        removePoint(point.id)
                      }}
                    />
                    <text x={coords.x} y={coords.y + 4} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
                      {point.units}
                    </text>
                  </g>
                )
              })}
            </FaceMap>
          </div>

          {/* Overlay se não estiver em modo de marcação */}
          {!isMarkingMode && products.length > 0 && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <p className="text-sm text-slate-500 font-medium">
                Selecione um produto e clique em "Iniciar marcação"
              </p>
            </div>
          )}
        </div>

        {/* Controles de edição */}
        {points.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={undoLastPoint}
                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center gap-1"
              >
                <Icon name="arrowLeft" className="w-3 h-3" />
                Desfazer
              </button>
              <button
                onClick={clearAllPoints}
                className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
              >
                Limpar tudo
              </button>
            </div>
            <span className="text-xs text-slate-500">
              Clique em um ponto para removê-lo
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
              onClick={saveInjections}
              disabled={saving}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <Icon name="check" className="w-4 h-4" />
                  Salvar {points.length} pontos ({totalUnits}U)
                </>
              )}
            </button>
          </>
        )}

        {/* Aplicações já salvas */}
        {currentInjections.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Aplicações salvas</p>
            {currentInjections.map(inj => (
              <div key={inj.id} className="flex items-center justify-between py-2 px-3 bg-emerald-50 rounded-lg mb-2">
                <span className="text-sm text-emerald-700">
                  {inj.product_name || (inj.products as { name: string } | null)?.name || 'Produto'}
                </span>
                <span className="text-sm font-semibold text-emerald-700">
                  {inj.total_units}U ({inj.injectable_points?.length || 0} pts)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
