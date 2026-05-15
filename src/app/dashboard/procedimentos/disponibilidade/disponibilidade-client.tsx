'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Procedure = { id: string; name: string }
type AvailableDate = { id: string; procedure_id: string; available_date: string; notes: string | null }

type Props = {
  clinicId: string
  procedures: Procedure[]
  initialDates: AvailableDate[]
}

// Grupos de aparelhos — todos os Hipro compartilham o mesmo calendário
type ApparatusGroup = {
  key: string
  label: string
  procedureIds: string[]
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function DisponibilidadeClient({ clinicId, procedures, initialDates }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [dates, setDates] = useState<AvailableDate[]>(initialDates)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Agrupar procedimentos: todos os Hipro em um grupo, Lavieen em outro
  const groups: ApparatusGroup[] = []

  const hipros = procedures.filter(p => p.name.toLowerCase().includes('hipro') || p.name.toLowerCase().includes('hi pro'))
  const lavieens = procedures.filter(p => p.name.toLowerCase().includes('lavieen'))
  const outros = procedures.filter(p => !hipros.includes(p) && !lavieens.includes(p))

  if (hipros.length > 0) groups.push({ key: 'hipro', label: 'Hipro', procedureIds: hipros.map(p => p.id) })
  if (lavieens.length > 0) groups.push({ key: 'lavieen', label: 'Lavieen', procedureIds: lavieens.map(p => p.id) })
  outros.forEach(p => groups.push({ key: p.id, label: p.name.trim(), procedureIds: [p.id] }))

  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.key || '')
  const currentGroup = groups.find(g => g.key === selectedGroup)

  // Calendário
  const today = new Date()
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const firstDay = new Date(calMonth.year, calMonth.month, 1).getDay()
  const totalDays = new Date(calMonth.year, calMonth.month + 1, 0).getDate()
  const calDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ]
  while (calDays.length % 7 !== 0) calDays.push(null)

  const toISO = (day: number) =>
    `${calMonth.year}-${String(calMonth.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  // Um dia está marcado se QUALQUER procedimento do grupo tiver essa data
  const datesForGroup = dates.filter(d => currentGroup?.procedureIds.includes(d.procedure_id))
  const datesSet = new Set(datesForGroup.map(d => d.available_date))

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function toggleDate(day: number) {
    if (!currentGroup) return
    const iso = toISO(day)
    const isMarked = datesSet.has(iso)

    if (isMarked) {
      // Remover de TODOS os procedimentos do grupo
      setDeleting(iso)
      const toRemove = datesForGroup.filter(d => d.available_date === iso)
      for (const d of toRemove) {
        await supabase.from('procedure_available_dates').delete().eq('id', d.id)
      }
      setDates(prev => prev.filter(d => !toRemove.find(r => r.id === d.id)))
      setDeleting(null)
      showToast('Dia removido')
    } else {
      // Adicionar para TODOS os procedimentos do grupo
      setSaving(iso)
      const inserted: AvailableDate[] = []
      for (const procId of currentGroup.procedureIds) {
        // Evitar duplicatas
        const alreadyExists = dates.find(d => d.procedure_id === procId && d.available_date === iso)
        if (alreadyExists) continue
        const { data } = await supabase
          .from('procedure_available_dates')
          .insert({ clinic_id: clinicId, procedure_id: procId, available_date: iso })
          .select()
          .single()
        if (data) inserted.push(data as AvailableDate)
      }
      setDates(prev => [...prev, ...inserted])
      setSaving(null)
      showToast(`Dia ${new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} marcado!`)
    }
    router.refresh()
  }

  // Datas futuras únicas do grupo (sem duplicar por procedimento)
  const upcoming = [...new Set(
    datesForGroup
      .filter(d => d.available_date >= today.toISOString().split('T')[0])
      .map(d => d.available_date)
  )].sort()

  async function removeDate(iso: string) {
    setDeleting(iso)
    const toRemove = datesForGroup.filter(d => d.available_date === iso)
    for (const d of toRemove) {
      await supabase.from('procedure_available_dates').delete().eq('id', d.id)
    }
    setDates(prev => prev.filter(d => !toRemove.find(r => r.id === d.id)))
    setDeleting(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Toast de feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2">
          ✓ {toast}
        </div>
      )}

      {/* Seletor de aparelho */}
      <div className="card p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Aparelho</label>
        <div className="flex gap-2 flex-wrap">
          {groups.map(g => (
            <button
              key={g.key}
              onClick={() => setSelectedGroup(g.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                selectedGroup === g.key
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {currentGroup && currentGroup.procedureIds.length > 1 && (
          <p className="text-xs text-slate-400 mt-2">
            Inclui {currentGroup.procedureIds.length} variações — o dia marcado vale para todas
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendário */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCalMonth(p => p.month === 0 ? { year: p.year-1, month: 11 } : { year: p.year, month: p.month-1 })}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
            >
              <Icon name="chevronLeft" className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-semibold text-slate-900">
              {MONTH_NAMES[calMonth.month]} {calMonth.year}
            </span>
            <button
              onClick={() => setCalMonth(p => p.month === 11 ? { year: p.year+1, month: 0 } : { year: p.year, month: p.month+1 })}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
            >
              <Icon name="chevronRight" className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map((day, idx) => {
              if (!day) return <div key={idx} />
              const iso = toISO(day)
              const isPast = iso < today.toISOString().split('T')[0]
              const isSelected = datesSet.has(iso)
              const isLoading = saving === iso || deleting === iso

              return (
                <button
                  key={idx}
                  disabled={isPast || isLoading || !currentGroup}
                  onClick={() => toggleDate(day)}
                  className={`h-9 w-full rounded-lg text-sm font-medium transition-all ${
                    isPast ? 'text-slate-200 cursor-not-allowed' :
                    isSelected ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md' :
                    'hover:bg-violet-50 hover:text-violet-700 text-slate-700'
                  }`}
                >
                  {isLoading ? (
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                  ) : day}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-slate-400 mt-3 text-center">
            Clique para marcar • Salva automaticamente
          </p>
        </div>

        {/* Lista de datas */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Dias marcados — {currentGroup?.label}
          </h3>

          {upcoming.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon name="alertTriangle" className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-slate-700">Nenhum dia marcado</p>
              <p className="text-xs text-slate-400 mt-1">
                A Eva <strong>não vai oferecer</strong> esse aparelho enquanto não houver dias disponíveis.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(iso => {
                const date = new Date(iso + 'T12:00:00')
                return (
                  <div key={iso} className="flex items-center justify-between p-2.5 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-sm font-semibold text-violet-900">
                      {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                    </p>
                    <button
                      onClick={() => removeDate(iso)}
                      disabled={deleting === iso}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-red-50 border border-slate-200 flex items-center justify-center transition-colors"
                    >
                      {deleting === iso
                        ? <span className="animate-spin w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full" />
                        : <Icon name="x" className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                      }
                    </button>
                  </div>
                )
              })}
              <p className="text-xs text-slate-400 mt-2 text-center">
                {upcoming.length} dia{upcoming.length !== 1 ? 's' : ''} marcado{upcoming.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Aviso */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Icon name="alertTriangle" className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Como funciona</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Quando um paciente pedir Lavieen ou Hipro, a Eva consulta esses dias e oferece <strong>apenas as datas marcadas</strong>.
              Se não houver nenhum dia, ela avisa que vai confirmar a data com a equipe e escala para humano.
              <br /><strong>Salva automaticamente ao clicar no dia.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
