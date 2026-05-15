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

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function DisponibilidadeClient({ clinicId, procedures, initialDates }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [dates, setDates] = useState<AvailableDate[]>(initialDates)
  const [selectedProc, setSelectedProc] = useState(procedures[0]?.id || '')
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Calendário
  const today = new Date()
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const firstDay = new Date(calMonth.year, calMonth.month, 1).getDay()
  const totalDays = new Date(calMonth.year, calMonth.month + 1, 0).getDate()
  const calDays: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]
  while (calDays.length % 7 !== 0) calDays.push(null)

  const toISO = (day: number) =>
    `${calMonth.year}-${String(calMonth.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  const datesForProc = dates.filter(d => d.procedure_id === selectedProc)
  const datesSet = new Set(datesForProc.map(d => d.available_date))

  async function toggleDate(day: number) {
    const iso = toISO(day)
    const existing = datesForProc.find(d => d.available_date === iso)

    if (existing) {
      // Remover
      setDeleting(iso)
      await supabase.from('procedure_available_dates').delete().eq('id', existing.id)
      setDates(prev => prev.filter(d => d.id !== existing.id))
      setDeleting(null)
    } else {
      // Adicionar
      setSaving(iso)
      const { data } = await supabase
        .from('procedure_available_dates')
        .insert({ clinic_id: clinicId, procedure_id: selectedProc, available_date: iso })
        .select()
        .single()
      if (data) setDates(prev => [...prev, data])
      setSaving(null)
    }
    router.refresh()
  }

  const procName = (id: string) => procedures.find(p => p.id === id)?.name || ''

  // Agrupar datas futuras por mês
  const upcoming = datesForProc
    .filter(d => d.available_date >= today.toISOString().split('T')[0])
    .sort((a, b) => a.available_date.localeCompare(b.available_date))

  return (
    <div className="space-y-6">
      {/* Seletor de procedimento */}
      <div className="card p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Aparelho / Procedimento</label>
        <select
          value={selectedProc}
          onChange={e => setSelectedProc(e.target.value)}
          className="input w-full"
        >
          {procedures.map(p => (
            <option key={p.id} value={p.id}>{p.name.trim()}</option>
          ))}
        </select>
        {procedures.length === 0 && (
          <p className="text-sm text-slate-400 mt-2">Nenhum procedimento com restrição de data encontrado.</p>
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
                  disabled={isPast || isLoading || !selectedProc}
                  onClick={() => toggleDate(day)}
                  className={`h-9 w-full rounded-lg text-sm font-medium transition-all relative ${
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
            Clique em um dia para marcar/desmarcar como disponível
          </p>
        </div>

        {/* Lista de datas marcadas */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Dias disponíveis — {procName(selectedProc).trim().split('-')[0].trim()}
          </h3>

          {upcoming.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon name="alertTriangle" className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-slate-700">Nenhum dia marcado</p>
              <p className="text-xs text-slate-400 mt-1">
                A Eva <strong>não vai oferecer</strong> esse procedimento enquanto não houver dias disponíveis.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(d => {
                const date = new Date(d.available_date + 'T12:00:00')
                return (
                  <div key={d.id} className="flex items-center justify-between p-2.5 bg-violet-50 rounded-xl border border-violet-100">
                    <div>
                      <p className="text-sm font-semibold text-violet-900">
                        {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setDeleting(d.id)
                        await supabase.from('procedure_available_dates').delete().eq('id', d.id)
                        setDates(prev => prev.filter(x => x.id !== d.id))
                        setDeleting(null)
                      }}
                      disabled={deleting === d.id}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-red-50 border border-slate-200 flex items-center justify-center transition-colors"
                    >
                      {deleting === d.id
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
              Quando um paciente pedir Lavieen ou Hipro, a Eva vai consultar esses dias e oferecer <strong>apenas as datas marcadas aqui</strong>.
              Se não houver nenhum dia marcado, ela vai dizer que vai confirmar a data disponível com a equipe e escalar para humano.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
