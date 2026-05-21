'use client'

import { useState, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ADULT_TEETH, CHILD_TEETH, ToothCondition, CONDITION_LABELS, CONDITION_COLORS } from './teeth-data'
import { ToothSVG, ToothConditionPanel } from './ToothSVG'

type ToothState = {
  conditions: ToothCondition[]
  notes: string
}

type OdontogramProps = {
  patientId: string
  clinicId: string
  appointmentId?: string
  initialData?: {
    id: string
    tooth_type: 'adult' | 'child'
    notes: string | null
    odontogram_teeth: Array<{
      tooth_number: number
      conditions: ToothCondition[]
      notes: string | null
    }>
  } | null
}

export default function OdontogramClient({
  patientId,
  clinicId,
  appointmentId,
  initialData,
}: OdontogramProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const [toothType, setToothType] = useState<'adult' | 'child'>(
    initialData?.tooth_type || 'adult'
  )
  const [teeth, setTeeth] = useState<Record<number, ToothState>>(() => {
    const map: Record<number, ToothState> = {}
    for (const t of initialData?.odontogram_teeth || []) {
      map[t.tooth_number] = { conditions: t.conditions, notes: t.notes || '' }
    }
    return map
  })
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [generalNotes, setGeneralNotes] = useState(initialData?.notes || '')
  const [odontogramId, setOdontogramId] = useState<string | null>(initialData?.id || null)
  const [saving, startSaving] = useTransition()
  const [saved, setSaved] = useState(false)

  const teethData = toothType === 'adult' ? ADULT_TEETH : CHILD_TEETH

  function toggleCondition(toothNumber: number, condition: ToothCondition) {
    setTeeth(prev => {
      const current = prev[toothNumber] || { conditions: [], notes: '' }
      const has = current.conditions.includes(condition)
      return {
        ...prev,
        [toothNumber]: {
          ...current,
          conditions: has
            ? current.conditions.filter(c => c !== condition)
            : [...current.conditions, condition],
        },
      }
    })
  }

  function setToothNotes(toothNumber: number, notes: string) {
    setTeeth(prev => ({
      ...prev,
      [toothNumber]: { ...(prev[toothNumber] || { conditions: [] }), notes },
    }))
  }

  async function handleSave() {
    startSaving(async () => {
      let odoId = odontogramId

      if (!odoId) {
        const { data } = await supabase
          .from('odontograms')
          .insert({
            clinic_id: clinicId,
            patient_id: patientId,
            appointment_id: appointmentId || null,
            tooth_type: toothType,
            notes: generalNotes,
          })
          .select('id')
          .single()
        odoId = data?.id || null
        setOdontogramId(odoId)
      } else {
        await supabase
          .from('odontograms')
          .update({ tooth_type: toothType, notes: generalNotes, updated_at: new Date().toISOString() })
          .eq('id', odoId)
      }

      if (!odoId) return

      // Deletar marcações antigas e reinserir
      await supabase.from('odontogram_teeth').delete().eq('odontogram_id', odoId)

      const rows = Object.entries(teeth)
        .filter(([, v]) => v.conditions.length > 0)
        .map(([num, v]) => ({
          odontogram_id: odoId,
          tooth_number: parseInt(num),
          conditions: v.conditions,
          notes: v.notes || null,
        }))

      if (rows.length > 0) {
        await supabase.from('odontogram_teeth').insert(rows)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function clearAll() {
    if (!confirm('Limpar todas as marcações?')) return
    setTeeth({})
    setSelectedTooth(null)
  }

  const markedCount = Object.values(teeth).filter(t => t.conditions.length > 0).length

  // Linha divisória central
  const centerX = 315

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tipo de dentição */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => { setToothType('adult'); setSelectedTooth(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              toothType === 'adult'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Adulto (32)
          </button>
          <button
            onClick={() => { setToothType('child'); setSelectedTooth(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              toothType === 'child'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Leite (20)
          </button>
        </div>

        <span className="text-xs text-slate-500">
          {markedCount} dente{markedCount !== 1 ? 's' : ''} marcado{markedCount !== 1 ? 's' : ''}
        </span>

        <div className="flex gap-2 ml-auto">
          {markedCount > 0 && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-medium">
              Limpar tudo
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
          >
            {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar odontograma'}
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CONDITION_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: CONDITION_COLORS[key as ToothCondition] }}
            />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* SVG do odontograma */}
      <div className="relative bg-slate-50 rounded-2xl border border-slate-200 p-4 overflow-x-auto">
        <svg
          viewBox="0 0 640 200"
          className="w-full min-w-[500px]"
          style={{ minHeight: 200 }}
        >
          {/* Linha divisória horizontal */}
          <line x1={10} y1={95} x2={630} y2={95} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,3" />
          {/* Linha divisória vertical */}
          <line x1={centerX} y1={5} x2={centerX} y2={195} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,3" />

          {/* Labels dos quadrantes */}
          <text x={20} y={92} fontSize={8} fill="#94a3b8">Q1</text>
          <text x={600} y={92} fontSize={8} fill="#94a3b8">Q2</text>
          <text x={600} y={108} fontSize={8} fill="#94a3b8">Q3</text>
          <text x={20} y={108} fontSize={8} fill="#94a3b8">Q4</text>

          {/* Dentes */}
          {teethData.map(tooth => (
            <ToothSVG
              key={tooth.number}
              number={tooth.number}
              x={tooth.x}
              y={tooth.y}
              conditions={teeth[tooth.number]?.conditions || []}
              selected={selectedTooth === tooth.number}
              onClick={() => setSelectedTooth(
                selectedTooth === tooth.number ? null : tooth.number
              )}
            />
          ))}
        </svg>

        {/* Painel de condições */}
        {selectedTooth !== null && (
          <ToothConditionPanel
            toothNumber={selectedTooth}
            conditions={teeth[selectedTooth]?.conditions || []}
            notes={teeth[selectedTooth]?.notes || ''}
            onToggle={c => toggleCondition(selectedTooth, c)}
            onNotes={n => setToothNotes(selectedTooth, n)}
            onClose={() => setSelectedTooth(null)}
          />
        )}
      </div>

      {/* Observações gerais */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Observações gerais do odontograma</label>
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="Plano de tratamento, observações gerais..."
          value={generalNotes}
          onChange={e => setGeneralNotes(e.target.value)}
        />
      </div>
    </div>
  )
}
