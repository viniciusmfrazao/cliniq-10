'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'

export default function RoomCostCard({
  appointmentId,
  initialCost,
}: {
  appointmentId: string
  initialCost: number
}) {
  const [cost, setCost] = useState(initialCost)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(initialCost || ''))
  const [saving, setSaving] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const save = async () => {
    const val = parseFloat(draft.replace(',', '.')) || 0
    setSaving(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ room_cost: val })
        .eq('id', appointmentId)
      if (error) throw error
      setCost(val)
      setEditing(false)
    } catch {
      alert('Erro ao salvar custo da sala.')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Custo da sala</h3>
          <p className="text-xs text-slate-500">Aluguel ou taxa de uso do espaço</p>
        </div>
        {!editing && (
          <button
            onClick={() => { setDraft(String(cost || '')); setEditing(true) }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Icon name="pencil" className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      <div className="p-4">
        {editing ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="0,00"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-violet-500 outline-none"
              autoFocus
            />
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving ? '...' : 'Salvar'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <Icon name="x" className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icon name="home" className="w-4 h-4 text-amber-600" />
            </div>
            {cost > 0 ? (
              <div>
                <p className="text-lg font-bold text-slate-900">{fmt(cost)}</p>
                <p className="text-xs text-slate-400">será descontado da margem deste atendimento</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-400">Nenhum custo de sala lançado</p>
                <button
                  onClick={() => { setDraft(''); setEditing(true) }}
                  className="text-xs text-violet-600 hover:underline"
                >
                  Lançar custo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
