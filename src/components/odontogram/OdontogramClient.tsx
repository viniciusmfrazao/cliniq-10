'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const CONDITIONS = [
  { id: 'carie',       label: 'Cárie',       color: '#ef4444' },
  { id: 'restauracao', label: 'Restauração',  color: '#3b82f6' },
  { id: 'coroa',       label: 'Coroa',        color: '#f59e0b' },
  { id: 'canal',       label: 'Canal',        color: '#8b5cf6' },
  { id: 'extracao',    label: 'Extração',     color: '#6b7280' },
  { id: 'implante',    label: 'Implante',     color: '#10b981' },
  { id: 'fratura',     label: 'Fratura',      color: '#f97316' },
  { id: 'ausente',     label: 'Ausente',      color: '#94a3b8' },
  { id: 'protese',     label: 'Prótese',      color: '#ec4899' },
  { id: 'selante',     label: 'Selante',      color: '#06b6d4' },
] as const

type ConditionId = typeof CONDITIONS[number]['id']

const ADULT_UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28]
const ADULT_LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]
const CHILD_UPPER = [55,54,53,52,51,61,62,63,64,65]
const CHILD_LOWER = [85,84,83,82,81,71,72,73,74,75]

function toothShape(n: number): 'molar' | 'premolar' | 'canino' | 'incisivo' {
  const d = n % 10
  if ([6,7,8].includes(d)) return 'molar'
  if ([4,5].includes(d)) return 'premolar'
  if (d === 3) return 'canino'
  return 'incisivo'
}

function getToothPath(type: string, upper: boolean, cx: number, cy: number): string {
  if (type === 'molar') {
    const w=22, h=20, x=cx-w/2, y=upper?cy-h:cy, r=5
    return `M${x+r},${y} Q${cx},${y-4} ${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} Q${cx},${y+h+3} ${x+r},${y+h} Q${x},${y+h} ${x},${y+h-r} L${x},${y+r} Q${x},${y} ${x+r},${y}Z`
  }
  if (type === 'premolar') {
    const w=17, h=18, x=cx-w/2, y=upper?cy-h:cy, r=4
    return `M${x+r},${y} Q${cx},${y-5} ${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} Q${cx},${y+h+2} ${x+r},${y+h} Q${x},${y+h} ${x},${y+h-r} L${x},${y+r} Q${x},${y} ${x+r},${y}Z`
  }
  if (type === 'canino') {
    const w=14, h=22, x=cx-w/2, y=upper?cy-h:cy
    if (upper) return `M${cx},${y} L${x+w},${y+8} L${x+w},${y+h-4} Q${x+w},${y+h} ${x+w-3},${y+h} Q${cx},${y+h+3} ${x+3},${y+h} Q${x},${y+h} ${x},${y+h-4} L${x},${y+8}Z`
    return `M${x},${y+4} Q${x},${y} ${x+3},${y} Q${cx},${y-3} ${x+w-3},${y} Q${x+w},${y} ${x+w},${y+4} L${x+w},${y+h-8} L${cx},${y+h}Z`
  }
  const w=13, h=19, x=cx-w/2, y=upper?cy-h:cy, r=3
  return `M${x+r},${y} Q${cx},${y-3} ${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} Q${cx},${y+h+2} ${x+r},${y+h} Q${x},${y+h} ${x},${y+h-r} L${x},${y+r} Q${x},${y} ${x+r},${y}Z`
}

function getPositions(teeth: number[], upper: boolean) {
  const n = teeth.length
  const midX = 320, baseY = upper ? 100 : 110, spacing = upper === true && n <= 10 ? 44 : 37
  return teeth.map((_, i) => {
    const pos = i - (n-1)/2
    const x = midX + pos * spacing
    const curve = Math.sqrt(Math.max(0, 5800 - pos*pos*spacing*spacing*0.18))
    const y = baseY + (upper ? curve*0.32 : curve*0.32) - 5
    return { x, y }
  })
}

function ToothArc({ teeth, upper, states, selectedCondition, onToothClick }: {
  teeth: number[]
  upper: boolean
  states: Record<number, ConditionId[]>
  selectedCondition: ConditionId
  onToothClick: (n: number) => void
}) {
  const positions = getPositions(teeth, upper)
  const H = 160

  return (
    <svg width="100%" viewBox="0 0 640 160" style={{ overflow: 'visible' }}>
      {teeth.map((num, i) => {
        const { x, y } = positions[i]
        const type = toothShape(num)
        const d = getToothPath(type, upper, x, y)
        const conds = states[num] || []
        const mainColor = conds.length > 0 ? CONDITIONS.find(c => c.id === conds[0])?.color || '#f8fafc' : '#f8fafc'
        const stroke = conds.length > 0 ? '#94a3b8' : '#d1d5db'
        const textColor = conds.length > 0 ? '#fff' : '#94a3b8'
        const numY = upper ? y + 16 : y - 8
        const dotY = upper ? y - 5 : y + (type === 'molar' ? 25 : type === 'premolar' ? 23 : 27)

        return (
          <g key={num} onClick={() => onToothClick(num)} style={{ cursor: 'pointer' }}>
            <path
              d={d}
              fill={mainColor}
              stroke={stroke}
              strokeWidth={1.2}
              style={{ transition: 'all 0.15s' }}
            />
            {conds.slice(1, 4).map((c, di) => (
              <circle
                key={c}
                cx={x - 6 + di * 6}
                cy={dotY}
                r={3}
                fill={CONDITIONS.find(x => x.id === c)?.color || '#888'}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
            <text
              x={x}
              y={numY}
              textAnchor="middle"
              fontSize={9}
              fontWeight={500}
              fill={textColor}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {num}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

type Props = {
  patientId: string
  clinicId: string
  appointmentId?: string
  initialData?: {
    id: string
    tooth_type: 'adult' | 'child'
    notes: string | null
    odontogram_teeth: Array<{
      tooth_number: number
      conditions: ConditionId[]
      notes: string | null
    }>
  } | null
}

export default function OdontogramClient({ patientId, clinicId, appointmentId, initialData }: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const [toothType, setToothType] = useState<'adult' | 'child'>(initialData?.tooth_type || 'adult')
  const [selectedCondition, setSelectedCondition] = useState<ConditionId>('carie')
  const [states, setStates] = useState<Record<number, ConditionId[]>>(() => {
    const map: Record<number, ConditionId[]> = {}
    for (const t of initialData?.odontogram_teeth || []) {
      map[t.tooth_number] = t.conditions
    }
    return map
  })
  const [generalNotes, setGeneralNotes] = useState(initialData?.notes || '')
  const [odontogramId, setOdontogramId] = useState<string | null>(initialData?.id || null)
  const [saving, startSaving] = useTransition()
  const [saved, setSaved] = useState(false)

  const upper = toothType === 'adult' ? ADULT_UPPER : CHILD_UPPER
  const lower = toothType === 'adult' ? ADULT_LOWER : CHILD_LOWER
  const markedCount = Object.keys(states).length

  function clickTooth(num: number) {
    setStates(prev => {
      const conds = prev[num] || []
      const has = conds.includes(selectedCondition)
      const next = has
        ? conds.filter(c => c !== selectedCondition)
        : [selectedCondition, ...conds.filter(c => c !== selectedCondition)]
      if (next.length === 0) {
        const { [num]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [num]: next }
    })
  }

  async function handleSave() {
    startSaving(async () => {
      let odoId = odontogramId

      if (!odoId) {
        const { data, error: errCreate } = await supabase.from('odontograms').insert({
          clinic_id: clinicId,
          patient_id: patientId,
          appointment_id: appointmentId || null,
          tooth_type: toothType,
          notes: generalNotes,
        }).select('id').single()

        if (errCreate) {
          console.error('[Odontogram] erro ao criar:', errCreate)
          alert('Erro ao salvar: ' + errCreate.message)
          return
        }
        odoId = data?.id || null
        if (odoId) setOdontogramId(odoId)
      } else {
        const { error: errUpdate } = await supabase.from('odontograms')
          .update({ tooth_type: toothType, notes: generalNotes, updated_at: new Date().toISOString() })
          .eq('id', odoId)
        if (errUpdate) {
          console.error('[Odontogram] erro ao atualizar:', errUpdate)
          alert('Erro ao salvar: ' + errUpdate.message)
          return
        }
      }

      if (!odoId) { console.error('[Odontogram] odoId nulo após criar'); return }

      await supabase.from('odontogram_teeth').delete().eq('odontogram_id', odoId)

      const rows = Object.entries(states)
        .filter(([, v]) => v.length > 0)
        .map(([num, v]) => ({
          odontogram_id: odoId,
          tooth_number: parseInt(num),
          conditions: v,
          notes: null,
        }))

      if (rows.length > 0) {
        const { error: errTeeth } = await supabase.from('odontogram_teeth').insert(rows)
        if (errTeeth) {
          console.error('[Odontogram] erro ao salvar dentes:', errTeeth)
          alert('Erro ao salvar dentes: ' + errTeeth.message)
          return
        }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {(['adult','child'] as const).map((t, i) => (
            <button key={t} onClick={() => setToothType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${toothType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {i === 0 ? 'Adulto (32)' : 'Leite (20)'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {markedCount > 0 && (
            <span className="text-xs text-slate-500">{markedCount} dente{markedCount !== 1 ? 's' : ''} marcado{markedCount !== 1 ? 's' : ''}</span>
          )}
          <button onClick={handleSave} disabled={saving}
            className="btn-primary text-sm py-2 px-4">
            {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Legenda — seleciona condição */}
      <div className="flex flex-wrap gap-2">
        {CONDITIONS.map(c => (
          <button key={c.id} onClick={() => setSelectedCondition(c.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${selectedCondition === c.id ? 'text-white' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 border'}`}
            style={selectedCondition === c.id ? { backgroundColor: c.color, borderColor: c.color } : {}}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCondition === c.id ? '#fff' : c.color }} />
            {c.label}
          </button>
        ))}
      </div>

      {/* SVG Odontograma */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 overflow-x-auto">
        <div style={{ minWidth: 500 }}>
          <ToothArc teeth={upper} upper={true} states={states} selectedCondition={selectedCondition} onToothClick={clickTooth} />
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <span className="text-[10px] text-slate-300 font-medium tracking-wider">SUPERIOR · INFERIOR</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>
          <ToothArc teeth={lower} upper={false} states={states} selectedCondition={selectedCondition} onToothClick={clickTooth} />
        </div>
      </div>

      {/* Dica */}
      <p className="text-xs text-slate-400 text-center">
        Selecione uma condição acima e clique nos dentes para marcar • Clique novamente para desmarcar
      </p>

      {/* Observações */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Observações gerais</label>
        <textarea className="input resize-none" rows={2}
          placeholder="Plano de tratamento, observações gerais..."
          value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} />
      </div>
    </div>
  )
}
