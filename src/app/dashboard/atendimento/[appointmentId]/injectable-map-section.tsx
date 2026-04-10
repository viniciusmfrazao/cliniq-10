'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'
import FaceMap from '@/components/ui/FaceMap'

type Point = {
  id: string
  x: number
  y: number
  region: string
  product_id: string
  product_name: string
  units: number
  lot?: string
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
    products: { name: string } | null
    injectable_points: Array<{ x: number; y: number; region: string; units: number }>
  }>
  clinicId: string
}

const REGIONS = [
  'Testa', 'Glabela', 'Periorbital D', 'Periorbital E', 
  'Nariz', 'Zigomático D', 'Zigomático E', 'Nasolabial D', 'Nasolabial E',
  'Lábio Superior', 'Lábio Inferior', 'Mento', 'Mandíbula D', 'Mandíbula E',
  'Malar D', 'Malar E', 'Têmpora D', 'Têmpora E'
]

export default function InjectableMapSection({ patient, appointmentId, products, currentInjections, clinicId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tempPoint, setTempPoint] = useState<{ x: number; y: number } | null>(null)

  const [formData, setFormData] = useState({
    region: '',
    product_id: '',
    units: 1
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    // Coordenadas em % do SVG (0-100)
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setTempPoint({ x, y })
    setFormData({ region: '', product_id: '', units: 1 })
    setShowModal(true)
  }

  // Converter coordenadas % para viewBox do FaceMap (0-300 x 0-400)
  const toSvgCoords = (x: number, y: number) => ({
    x: (x / 100) * 300,
    y: (y / 100) * 400
  })

  const addPoint = () => {
    if (!tempPoint || !formData.region || !formData.product_id) {
      alert('Preencha todos os campos')
      return
    }

    const product = products.find(p => p.id === formData.product_id)
    if (!product) return

    const newPoint: Point = {
      id: `temp-${Date.now()}`,
      x: tempPoint.x,
      y: tempPoint.y,
      region: formData.region,
      product_id: formData.product_id,
      product_name: product.name,
      units: formData.units,
      lot: product.batch_number || undefined
    }

    setPoints([...points, newPoint])
    setShowModal(false)
    setTempPoint(null)
  }

  const removePoint = (id: string) => {
    setPoints(points.filter(p => p.id !== id))
  }

  const totalUnits = points.reduce((acc, p) => acc + p.units, 0)

  const saveInjections = async () => {
    if (points.length === 0) {
      alert('Adicione pelo menos um ponto de aplicação')
      return
    }

    setSaving(true)

    try {
      // Agrupar por produto
      const byProduct = points.reduce((acc, p) => {
        if (!acc[p.product_id]) acc[p.product_id] = []
        acc[p.product_id].push(p)
        return acc
      }, {} as Record<string, Point[]>)

      for (const [productId, productPoints] of Object.entries(byProduct)) {
        const product = products.find(p => p.id === productId)
        const totalProductUnits = productPoints.reduce((a, p) => a + p.units, 0)

        // Criar aplicacao
        const { data: application, error: appError } = await supabase
          .from('injectable_applications')
          .insert({
            clinic_id: clinicId,
            patient_id: patient.id,
            appointment_id: appointmentId,
            product_id: productId,
            product_name: product?.name || 'Produto',
            total_units: totalProductUnits,
            stock_deducted: false
          })
          .select()
          .single()

        if (appError) throw appError

        // Criar pontos
        const pointsData = productPoints.map(p => ({
          application_id: application.id,
          x: p.x,
          y: p.y,
          region: p.region,
          units: p.units
        }))

        await supabase.from('injectable_points').insert(pointsData)
      }

      setPoints([])
      alert('Aplicações salvas com sucesso!\n\nO estoque será descontado ao finalizar o atendimento.')
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar aplicações')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Mapa de Injetáveis</h3>
          <p className="text-xs text-slate-500">Clique no rosto para adicionar pontos</p>
        </div>
        {points.length > 0 && (
          <span className="text-sm font-semibold text-[var(--color-primary)]">
            {totalUnits} unidades
          </span>
        )}
      </div>

      <div className="p-4">
        {/* SVG Face Map Profissional */}
        <div className="relative bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl p-4 mb-4">
          <FaceMap ref={svgRef} onClick={handleSvgClick} showRegions={true}>
            {/* Pontos existentes deste atendimento */}
            {currentInjections.flatMap(inj => 
              inj.injectable_points?.map((p, i) => {
                const coords = toSvgCoords(p.x, p.y)
                return (
                  <g key={`existing-${inj.id}-${i}`}>
                    <circle 
                      cx={coords.x} 
                      cy={coords.y} 
                      r="10" 
                      fill="#64748b" 
                      stroke="white" 
                      strokeWidth="2"
                      filter="url(#softGlow)"
                    />
                    <text x={coords.x} y={coords.y + 4} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
                      {p.units}
                    </text>
                  </g>
                )
              })
            )}

            {/* Pontos novos */}
            {points.map((point) => {
              const coords = toSvgCoords(point.x, point.y)
              return (
                <g key={point.id} onClick={(e) => { e.stopPropagation(); setSelectedPoint(point); }}>
                  <circle 
                    cx={coords.x} 
                    cy={coords.y} 
                    r="12" 
                    fill="var(--color-primary)" 
                    stroke="white" 
                    strokeWidth="3"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    filter="url(#softGlow)"
                  />
                  <text x={coords.x} y={coords.y + 4} textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">
                    {point.units}
                  </text>
                </g>
              )
            })}

            {/* Ponto temporário */}
            {tempPoint && (() => {
              const coords = toSvgCoords(tempPoint.x, tempPoint.y)
              return (
                <circle 
                  cx={coords.x} 
                  cy={coords.y} 
                  r="8" 
                  fill="var(--color-accent)" 
                  stroke="white" 
                  strokeWidth="2"
                  className="animate-pulse"
                />
              )
            })()}
          </FaceMap>
        </div>

        {/* Lista de pontos adicionados */}
        {points.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="text-sm font-semibold text-slate-700">Pontos adicionados:</h4>
            {points.map(point => (
              <div key={point.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="font-medium text-slate-900">{point.region}</span>
                  <span className="text-sm text-slate-500 ml-2">
                    {point.product_name} • {point.units}U
                  </span>
                </div>
                <button
                  onClick={() => removePoint(point.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Alerta de estoque */}
        {points.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl mb-4">
            <Icon name="bell" className="w-4 h-4 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-700">
              O estoque será descontado automaticamente ao finalizar o atendimento.
            </p>
          </div>
        )}

        {/* Botão Salvar */}
        {points.length > 0 && (
          <button
            onClick={saveInjections}
            disabled={saving}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                <Icon name="check" className="w-4 h-4" />
                Salvar aplicações ({totalUnits} unidades)
              </>
            )}
          </button>
        )}

        {/* Aplicações já salvas */}
        {currentInjections.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Aplicações salvas:</h4>
            {currentInjections.map(inj => (
              <div key={inj.id} className="flex items-center justify-between py-2 px-3 bg-emerald-50 rounded-lg mb-2">
                <span className="text-sm text-emerald-700">
                  {(inj.products as { name: string } | null)?.name || 'Produto'}
                </span>
                <span className="text-sm font-semibold text-emerald-700">
                  {inj.total_units}U
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para adicionar ponto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slide-up">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Adicionar ponto</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Região</label>
                <select
                  value={formData.region}
                  onChange={e => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Selecione...</option>
                  {REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
                <select
                  value={formData.product_id}
                  onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Selecione...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.current_stock} em estoque)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unidades</label>
                <input
                  type="number"
                  min="1"
                  value={formData.units}
                  onChange={e => setFormData({ ...formData, units: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setTempPoint(null); }}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={addPoint}
                className="flex-1 btn-primary"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
