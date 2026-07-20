'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FaceMapEditor from '../face-map-editor'
import PhotoSimulator from './photo-simulator'
import Icon from '@/components/ui/Icon'

type Product = {
  id: string
  name: string
  brand: string | null
  current_stock: number
  unit: string
  cost_price: number | null
  sale_price: number | null
}

type SimPoint = {
  id: string
  zone: string
  muscle: string
  side: string
  x: number
  y: number
  units: number
  depth: string
  technique: string
}

// ── Templates de protocolo (coordenadas no viewBox frontal 320x420) ──────────
const TEMPLATES: { id: string; name: string; type: string; desc: string; points: Omit<SimPoint, 'id'>[] }[] = [
  {
    id: 'fullface_toxin',
    name: 'Full face toxina',
    type: 'toxin',
    desc: 'Frontal + glabela + periorbital (~50U)',
    points: [
      { zone: 'forehead', muscle: 'Frontal', side: 'left', x: 130, y: 105, units: 4, depth: 'intramuscular', technique: 'serial' },
      { zone: 'forehead', muscle: 'Frontal', side: 'center', x: 160, y: 100, units: 4, depth: 'intramuscular', technique: 'serial' },
      { zone: 'forehead', muscle: 'Frontal', side: 'right', x: 190, y: 105, units: 4, depth: 'intramuscular', technique: 'serial' },
      { zone: 'glabella', muscle: 'Procerus', side: 'center', x: 160, y: 140, units: 6, depth: 'intramuscular', technique: 'bolus' },
      { zone: 'glabella', muscle: 'Corrugador', side: 'left', x: 143, y: 137, units: 5, depth: 'intramuscular', technique: 'bolus' },
      { zone: 'glabella', muscle: 'Corrugador', side: 'right', x: 177, y: 137, units: 5, depth: 'intramuscular', technique: 'bolus' },
      { zone: 'crow_feet', muscle: 'Orbicular lateral', side: 'left', x: 90, y: 155, units: 6, depth: 'intradermica', technique: 'serial' },
      { zone: 'crow_feet', muscle: 'Orbicular lateral', side: 'right', x: 230, y: 155, units: 6, depth: 'intradermica', technique: 'serial' },
      { zone: 'eyebrow', muscle: 'Frontal lateral', side: 'left', x: 105, y: 130, units: 3, depth: 'intramuscular', technique: 'bolus' },
      { zone: 'eyebrow', muscle: 'Frontal lateral', side: 'right', x: 215, y: 130, units: 3, depth: 'intramuscular', technique: 'bolus' },
    ],
  },
  {
    id: 'glabela',
    name: 'Glabela',
    type: 'toxin',
    desc: 'Procerus + corrugadores (~16-20U)',
    points: [
      { zone: 'glabella', muscle: 'Procerus', side: 'center', x: 160, y: 140, units: 6, depth: 'intramuscular', technique: 'bolus' },
      { zone: 'glabella', muscle: 'Corrugador', side: 'left', x: 143, y: 137, units: 6, depth: 'intramuscular', technique: 'bolus' },
      { zone: 'glabella', muscle: 'Corrugador', side: 'right', x: 177, y: 137, units: 6, depth: 'intramuscular', technique: 'bolus' },
    ],
  },
  {
    id: 'masseter',
    name: 'Masseter (bruxismo)',
    type: 'toxin',
    desc: 'Slim facial / bruxismo (~40-60U)',
    points: [
      { zone: 'jawline', muscle: 'Masseter', side: 'left', x: 95, y: 250, units: 25, depth: 'intramuscular', technique: 'serial' },
      { zone: 'jawline', muscle: 'Masseter', side: 'right', x: 225, y: 250, units: 25, depth: 'intramuscular', technique: 'serial' },
    ],
  },
  {
    id: 'labios',
    name: 'Preenchimento labial',
    type: 'filler',
    desc: 'Vermelhão sup./inf. (~1ml)',
    points: [
      { zone: 'lip', muscle: 'Vermelhão superior', side: 'left', x: 148, y: 246, units: 0.25, depth: 'subcutanea', technique: 'retroinjecao' },
      { zone: 'lip', muscle: 'Vermelhão superior', side: 'right', x: 172, y: 246, units: 0.25, depth: 'subcutanea', technique: 'retroinjecao' },
      { zone: 'lip', muscle: 'Vermelhão inferior', side: 'left', x: 150, y: 256, units: 0.25, depth: 'subcutanea', technique: 'retroinjecao' },
      { zone: 'lip', muscle: 'Vermelhão inferior', side: 'right', x: 170, y: 256, units: 0.25, depth: 'subcutanea', technique: 'retroinjecao' },
    ],
  },
  {
    id: 'malar',
    name: 'Malar / Maçãs do rosto',
    type: 'filler',
    desc: 'Projeção zigomática (~2ml)',
    points: [
      { zone: 'malar', muscle: 'Malar fat pad', side: 'left', x: 108, y: 195, units: 1, depth: 'supraperiostal', technique: 'bolus' },
      { zone: 'malar', muscle: 'Malar fat pad', side: 'right', x: 212, y: 195, units: 1, depth: 'supraperiostal', technique: 'bolus' },
    ],
  },
  {
    id: 'mandibula',
    name: 'Contorno mandibular',
    type: 'filler',
    desc: 'Definição de jawline (~2-4ml)',
    points: [
      { zone: 'jawline', muscle: 'Ângulo mandibular', side: 'left', x: 92, y: 268, units: 1, depth: 'supraperiostal', technique: 'bolus' },
      { zone: 'jawline', muscle: 'Ângulo mandibular', side: 'right', x: 228, y: 268, units: 1, depth: 'supraperiostal', technique: 'bolus' },
      { zone: 'chin', muscle: 'Mentoniano', side: 'center', x: 160, y: 300, units: 1, depth: 'supraperiostal', technique: 'bolus' },
    ],
  },
]

// ── Zonas de risco vascular para PREENCHEDOR (viewBox frontal 320x420) ──────
const RISK_ZONES = [
  { id: 'glabella', label: 'Glabela — a. supratroclear', cx: 160, cy: 140, r: 22 },
  { id: 'nose', label: 'Nariz — a. dorsal nasal', cx: 160, cy: 185, r: 20 },
  { id: 'nasolabial_l', label: 'Nasolabial — a. angular', cx: 132, cy: 222, r: 18 },
  { id: 'nasolabial_r', label: 'Nasolabial — a. angular', cx: 188, cy: 222, r: 18 },
  { id: 'temporal_l', label: 'Temporal — a. temporal superficial', cx: 82, cy: 122, r: 20 },
  { id: 'temporal_r', label: 'Temporal — a. temporal superficial', cx: 238, cy: 122, r: 20 },
]

const ZONE_NAMES: Record<string, string> = {
  forehead: 'Testa', glabella: 'Glabela', crow_feet: 'Pés de galinha', eyebrow: 'Sobrancelha',
  bunny_lines: 'Bunny lines', nose: 'Nariz', perioral_upper: 'Perioral sup.', perioral_lower: 'Perioral inf.',
  lip: 'Lábios', chin: 'Mento', marionette: 'Marionete', nasolabial: 'Nasolabial', malar: 'Malar',
  jawline: 'Mandíbula', submandibular: 'Submandibular', neck: 'Pescoço', temporal: 'Temporal',
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SimulatorClient({
  patientId,
  clinicId,
  professionalId,
  patientGender,
  products,
}: {
  patientId: string
  clinicId: string
  professionalId: string
  patientGender: 'female' | 'male'
  products: Product[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'plano' | 'foto'>('plano')
  const [type, setType] = useState<'toxin' | 'filler'>('toxin')
  const [productId, setProductId] = useState('')
  const [points, setPoints] = useState<SimPoint[]>([])
  const [markup, setMarkup] = useState(3)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const product = products.find(p => p.id === productId)
  const totalUnits = useMemo(() => points.reduce((s, p) => s + (p.units || 0), 0), [points])

  // ── Custo / orçamento ──────────────────────────────────────────────────────
  const costTotal = (product?.cost_price || 0) * totalUnits
  const priceSuggested = product?.sale_price
    ? product.sale_price * totalUnits
    : costTotal * markup

  // ── Simetria: unidades esq vs dir por zona ─────────────────────────────────
  const symmetry = useMemo(() => {
    const byZone: Record<string, { left: number; right: number }> = {}
    for (const p of points) {
      if (p.side !== 'left' && p.side !== 'right') continue
      if (!byZone[p.zone]) byZone[p.zone] = { left: 0, right: 0 }
      byZone[p.zone][p.side as 'left' | 'right'] += p.units || 0
    }
    const zones = Object.entries(byZone).map(([zone, v]) => {
      const max = Math.max(v.left, v.right)
      const score = max === 0 ? 100 : Math.round((Math.min(v.left, v.right) / max) * 100)
      return { zone, ...v, score }
    })
    const overall = zones.length === 0
      ? 100
      : Math.round(zones.reduce((s, z) => s + z.score, 0) / zones.length)
    return { zones, overall }
  }, [points])

  // ── Pontos de filler em zona de risco ──────────────────────────────────────
  const riskHits = useMemo(() => {
    if (type !== 'filler') return []
    const hits: { point: SimPoint; zone: typeof RISK_ZONES[0] }[] = []
    for (const p of points) {
      for (const rz of RISK_ZONES) {
        const d = Math.hypot(p.x - rz.cx, p.y - rz.cy)
        if (d <= rz.r) { hits.push({ point: p, zone: rz }); break }
      }
    }
    return hits
  }, [points, type])

  function applyTemplate(tpl: typeof TEMPLATES[0]) {
    setType(tpl.type as 'toxin' | 'filler')
    setPoints(tpl.points.map((p, i) => ({ ...p, id: `tpl-${Date.now()}-${i}` })))
  }

  async function saveSimulation() {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('injectable_simulations')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          professional_id: professionalId,
          type,
          product_id: productId || null,
          product_name: product?.name || null,
          points: points,
          total_units: totalUnits,
          cost_total: costTotal,
          price_suggested: priceSuggested,
          status: 'draft',
        })
        .select('id')
        .single()
      if (error) throw error
      setSavedId(data.id)
      router.refresh()
    } catch (err) {
      console.error('Erro ao salvar simulação', err)
      alert('Erro ao salvar simulação.')
    } finally {
      setSaving(false)
    }
  }

  const unitLabel = type === 'toxin' ? 'U' : 'ml'

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setTab('plano')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'plano' ? 'bg-white shadow text-purple-700' : 'text-slate-500'
          }`}
        >
          📋 Plano de tratamento
        </button>
        <button
          onClick={() => setTab('foto')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'foto' ? 'bg-white shadow text-purple-700' : 'text-slate-500'
          }`}
        >
          📸 Simulação na foto
        </button>
      </div>

      {tab === 'foto' ? (
        points.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-slate-500">Monte primeiro o plano de tratamento na aba ao lado — os pontos marcados serão usados para simular o efeito na foto.</p>
          </div>
        ) : (
          <div className="card p-6">
            <PhotoSimulator
              planPoints={points.map(p => ({ id: p.id, zone: p.zone, side: p.side, x: p.x, y: p.y, units: p.units }))}
              type={type}
            />
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna esquerda: mapa */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tipo + produto */}
            <div className="card p-4 flex flex-wrap gap-3 items-end">
              <div>
                <label className="label">Tipo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setType('toxin')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      type === 'toxin' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500'
                    }`}
                  >💉 Toxina</button>
                  <button
                    onClick={() => setType('filler')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      type === 'filler' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 text-slate-500'
                    }`}
                  >✨ Preenchedor</button>
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="label">Produto (para cálculo de custo)</label>
                <select className="input" value={productId} onChange={e => setProductId(e.target.value)}>
                  <option value="">Selecionar produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.brand ? ` — ${p.brand}` : ''} ({p.current_stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Zonas de risco alerta */}
            {riskHits.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <Icon name="alertCircle" className="w-4 h-4" />
                  {riskHits.length} ponto(s) em zona de risco vascular
                </p>
                <ul className="mt-2 space-y-1">
                  {riskHits.map((h, i) => (
                    <li key={i} className="text-xs text-red-600">
                      • {ZONE_NAMES[h.point.zone] || h.point.zone} ({h.point.units}{unitLabel}) — {h.zone.label}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-red-500 mt-2">
                  Regiões com risco de oclusão vascular em preenchimento. Redobre a atenção com aspiração, cânula e volume.
                </p>
              </div>
            )}

            {/* Editor de mapa (reutilizado) com overlay de zonas de risco */}
            <div className="card p-4">
              <FaceMapEditor
                points={points}
                setPoints={setPoints as any}
                type={type}
                gender={patientGender}
                overlay={
                  <g pointerEvents="none">
                    {RISK_ZONES.map(rz => (
                      <g key={rz.id}>
                        <circle
                          cx={rz.cx} cy={rz.cy} r={rz.r}
                          fill={type === 'filler' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.06)'}
                          stroke={type === 'filler' ? 'rgba(239,68,68,0.55)' : 'rgba(239,68,68,0.25)'}
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <text
                          x={rz.cx} y={rz.cy - rz.r - 3}
                          textAnchor="middle"
                          fontSize="7"
                          fill={type === 'filler' ? '#dc2626' : '#f0aaaa'}
                        >⚠</text>
                      </g>
                    ))}
                  </g>
                }
              />
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full border border-red-400 border-dashed bg-red-50" />
                Círculos tracejados = zonas de atenção vascular (risco relevante para preenchedor). Pontos de filler dentro delas geram alerta.
              </p>
            </div>
          </div>

          {/* Coluna direita: painéis */}
          <div className="space-y-4">
            {/* Orçamento */}
            <div className="card overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <p className="text-xs uppercase tracking-wide text-purple-200">Orçamento simulado</p>
                <p className="text-3xl font-bold mt-1">{fmtBRL(priceSuggested)}</p>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total marcado</span>
                  <span className="font-semibold text-slate-900">{totalUnits} {unitLabel} · {points.length} pontos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Custo do produto</span>
                  <span className="font-semibold text-slate-900">{product ? fmtBRL(costTotal) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Margem estimada</span>
                  <span className="font-semibold text-emerald-600">
                    {product ? fmtBRL(priceSuggested - costTotal) : '—'}
                  </span>
                </div>
                {product && !product.sale_price && (
                  <div className="pt-2">
                    <label className="text-xs text-slate-500">Markup (sem preço de venda cadastrado): {markup}x</label>
                    <input
                      type="range" min="1.5" max="6" step="0.5"
                      value={markup}
                      onChange={e => setMarkup(parseFloat(e.target.value))}
                      className="w-full accent-purple-600"
                    />
                  </div>
                )}
                {!product && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                    Selecione um produto para calcular custo e margem
                  </p>
                )}
              </div>
            </div>

            {/* Simetria */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-900">Simetria</p>
                <span className={`text-lg font-bold ${
                  symmetry.overall >= 90 ? 'text-emerald-600' : symmetry.overall >= 70 ? 'text-amber-600' : 'text-red-600'
                }`}>{symmetry.overall}%</span>
              </div>
              {symmetry.zones.length === 0 ? (
                <p className="text-xs text-slate-400">Marque pontos laterais para avaliar simetria esquerda/direita</p>
              ) : (
                <div className="space-y-2">
                  {symmetry.zones.map(z => (
                    <div key={z.zone}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-600">{ZONE_NAMES[z.zone] || z.zone}</span>
                        <span className="text-slate-400">E {z.left}{unitLabel} / D {z.right}{unitLabel}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${z.score >= 90 ? 'bg-emerald-500' : z.score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${z.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Templates */}
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-900 mb-3">Protocolos de referência</p>
              <div className="space-y-2">
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50 transition-all"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {tpl.type === 'toxin' ? '💉' : '✨'} {tpl.name}
                    </p>
                    <p className="text-xs text-slate-500">{tpl.desc}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Templates carregam pontos editáveis. Valores são referências gerais — ajuste conforme avaliação clínica.
              </p>
            </div>

            {/* Salvar */}
            <button
              onClick={saveSimulation}
              disabled={saving || points.length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
              ) : savedId ? (
                <><Icon name="check" className="w-4 h-4" />Simulação salva</>
              ) : (
                <><Icon name="check" className="w-4 h-4" />Salvar simulação</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
