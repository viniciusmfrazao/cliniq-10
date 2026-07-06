'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

interface Procedure {
  id: string
  name: string
  price: number
  duration_minutes: number
}

interface SelectedProc {
  id: string
  name: string
  price: number
}

interface Props {
  appointmentId: string
  clinicId: string
  patientName: string
  initialProcedureName?: string | null
  initialProcedureId?: string | null
  onConfirm: (procedures: SelectedProc[], desconto?: { tipo: 'valor' | 'percentual'; valor: number }) => Promise<void>
  onCancel: () => void
}

export default function ProceduresConfirmModal({
  appointmentId,
  clinicId,
  patientName,
  initialProcedureName,
  initialProcedureId,
  onConfirm,
  onCancel,
}: Props) {
  const supabase = createClient()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [selected, setSelected] = useState<SelectedProc[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [descontoTipo, setDescontoTipo] = useState<'valor' | 'percentual'>('valor')
  const [descontoValorStr, setDescontoValorStr] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('procedures')
        .select('id, name, price, duration_minutes')
        .eq('clinic_id', clinicId)
        .eq('active', true)
        .order('name')
      
      const list = data || []
      setProcedures(list)

      // Pré-selecionar o procedimento agendado
      if (initialProcedureId) {
        const found = list.find(p => p.id === initialProcedureId)
        if (found) setSelected([{ id: found.id, name: found.name, price: found.price }])
      } else if (initialProcedureName) {
        const found = list.find(p => p.name.toLowerCase() === initialProcedureName.toLowerCase())
        if (found) setSelected([{ id: found.id, name: found.name, price: found.price }])
      }

      setLoading(false)
    }
    load()
  }, [clinicId, initialProcedureId, initialProcedureName])

  function toggle(proc: Procedure) {
    setSelected(prev => {
      const exists = prev.find(p => p.id === proc.id)
      if (exists) return prev.filter(p => p.id !== proc.id)
      return [...prev, { id: proc.id, name: proc.name, price: proc.price }]
    })
  }

  const total = selected.reduce((sum, p) => sum + p.price, 0)
  const descontoNum = parseFloat(descontoValorStr) || 0
  const totalComDesconto = descontoNum > 0
    ? (descontoTipo === 'percentual' ? Math.max(0, total * (1 - descontoNum / 100)) : Math.max(0, total - descontoNum))
    : total
  const filtered = procedures.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleConfirm() {
    if (selected.length === 0) return
    setSaving(true)
    await onConfirm(selected, descontoNum > 0 ? { tipo: descontoTipo, valor: descontoNum } : undefined)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-slate-800">Confirmar procedimentos</h2>
            <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg">
              <Icon name="x" className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {patientName} — selecione o(s) procedimento(s) realizado(s)
          </p>
        </div>

        {/* Busca */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar procedimento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="loader" className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum procedimento encontrado</p>
          ) : (
            filtered.map(proc => {
              const isSelected = selected.some(p => p.id === proc.id)
              return (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => toggle(proc)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'border-violet-600 bg-violet-600' : 'border-slate-300'
                  }`}>
                    {isSelected && <Icon name="check" className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-violet-800' : 'text-slate-700'}`}>
                      {proc.name}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${isSelected ? 'text-violet-700' : 'text-slate-500'}`}>
                    {proc.price > 0 ? `R$ ${proc.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Gratuito'}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100">
          {selected.length > 0 && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs text-slate-500 flex-shrink-0">Desconto:</label>
                <select
                  value={descontoTipo}
                  onChange={e => setDescontoTipo(e.target.value as 'valor' | 'percentual')}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="valor">R$</option>
                  <option value="percentual">%</option>
                </select>
                <input
                  type="number" min={0} step={0.01} placeholder="0"
                  value={descontoValorStr}
                  onChange={e => setDescontoValorStr(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div className="mb-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-emerald-700">
                    {selected.length} procedimento{selected.length > 1 ? 's' : ''} selecionado{selected.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-base font-bold text-emerald-700">
                    Total: R$ {totalComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {descontoNum > 0 && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Subtotal R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com desconto aplicado
                  </p>
                )}
                <p className="text-xs text-emerald-600 mt-1 truncate">
                  {selected.map(p => p.name).join(', ')}
                </p>
              </div>
            </>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.length === 0 || saving}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Icon name="loader" className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : (
                <><Icon name="check" className="w-4 h-4" /> Confirmar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
