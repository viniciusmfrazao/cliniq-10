'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import Icon from '@/components/ui/Icon'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Profissional = {
  id: string
  name: string
  role: string
  professional_role: string | null
  recebe_comissao: boolean
  comissao_percentual: number | null
}

type Props = {
  clinicId: string
  initialAtiva: boolean
  initialBase: 'bruto' | 'liquido'
  profissionais: Profissional[]
}

export default function ComissoesForm({ clinicId, initialAtiva, initialBase, profissionais }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [ativa, setAtiva] = useState(initialAtiva)
  const [savingToggle, setSavingToggle] = useState(false)
  const [base, setBase] = useState<'bruto' | 'liquido'>(initialBase)
  const [savingBase, setSavingBase] = useState(false)
  const [list, setList] = useState(profissionais)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function handleToggleAtiva() {
    const novoValor = !ativa
    setAtiva(novoValor)
    setSavingToggle(true)

    const { data: clinic } = await supabase.from('clinics').select('settings').eq('id', clinicId).single()
    const { error } = await supabase.from('clinics').update({
      settings: { ...(clinic?.settings || {}), comissao_ativa: novoValor }
    }).eq('id', clinicId)

    setSavingToggle(false)

    if (error) {
      setAtiva(!novoValor)
      toast.error('Erro ao salvar', { description: error.message })
      return
    }

    toast.success(novoValor ? 'Comissões ativadas' : 'Comissões desativadas')
    router.refresh()
  }

  async function handleChangeBase(novaBase: 'bruto' | 'liquido') {
    const anterior = base
    setBase(novaBase)
    setSavingBase(true)

    const { data: clinic } = await supabase.from('clinics').select('settings').eq('id', clinicId).single()
    const { error } = await supabase.from('clinics').update({
      settings: { ...(clinic?.settings || {}), comissao_base: novaBase }
    }).eq('id', clinicId)

    setSavingBase(false)

    if (error) {
      setBase(anterior)
      toast.error('Erro ao salvar', { description: error.message })
      return
    }

    toast.success('Base de cálculo atualizada')
    router.refresh()
  }

  async function handleSaveProfissional(id: string, recebe_comissao: boolean, comissao_percentual: string) {
    setSavingId(id)

    const pct = comissao_percentual === '' ? null : Number(comissao_percentual)
    if (pct !== null && (isNaN(pct) || pct < 0 || pct > 100)) {
      toast.error('Percentual deve estar entre 0 e 100')
      setSavingId(null)
      return
    }

    try {
      const res = await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, recebe_comissao, comissao_percentual: pct })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error('Erro ao salvar', { description: data.error })
        setSavingId(null)
        return
      }
      setList(prev => prev.map(p => p.id === id ? { ...p, recebe_comissao, comissao_percentual: pct } : p))
      toast.success('Salvo')
    } catch {
      toast.error('Erro ao salvar')
    }
    setSavingId(null)
  }

  return (
    <div className="space-y-6">
      {/* Toggle geral */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow flex-shrink-0">
              <Icon name="dollarSign" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Trabalhar com comissão</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Quando ativo, o financeiro mostra o valor de cada profissional e da clínica em cada entrada
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAtiva}
            disabled={savingToggle}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${ativa ? 'bg-emerald-500' : 'bg-slate-300'} disabled:opacity-60`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${ativa ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Base de cálculo */}
      {ativa && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Comissão calculada sobre</h2>
          <p className="text-xs text-slate-500 mb-4">
            Bruto é o valor total cobrado do paciente. Líquido é o valor bruto menos a taxa de cartão/Pix — o que a
            clínica de fato recebe. Isso muda quanto a profissional vê como "vai receber".
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleChangeBase('bruto')}
              disabled={savingBase}
              className={`p-3 rounded-xl border-2 text-left transition-colors disabled:opacity-60 ${
                base === 'bruto' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">Valor Bruto</p>
              <p className="text-xs text-slate-500 mt-0.5">Total cobrado do paciente, antes da taxa</p>
            </button>
            <button
              onClick={() => handleChangeBase('liquido')}
              disabled={savingBase}
              className={`p-3 rounded-xl border-2 text-left transition-colors disabled:opacity-60 ${
                base === 'liquido' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">Valor Líquido</p>
              <p className="text-xs text-slate-500 mt-0.5">Depois de descontar a taxa de cartão/Pix</p>
            </button>
          </div>
        </div>
      )}

      {/* Profissionais */}
      {ativa && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Percentual por profissional</h2>
          <p className="text-xs text-slate-500 mb-4">
            Marque quem recebe comissão e defina o %. Calculado sobre o valor {base} de cada entrada.
          </p>

          {list.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhum profissional cadastrado. Defina o papel clínico em Equipe primeiro.
            </p>
          ) : (
            <div className="space-y-2">
              {list.map(p => (
                <ProfissionalRow
                  key={p.id}
                  profissional={p}
                  saving={savingId === p.id}
                  onSave={(recebe, pct) => handleSaveProfissional(p.id, recebe, pct)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProfissionalRow({
  profissional,
  saving,
  onSave,
}: {
  profissional: Profissional
  saving: boolean
  onSave: (recebe: boolean, pct: string) => void
}) {
  const [recebe, setRecebe] = useState(profissional.recebe_comissao)
  const [pct, setPct] = useState(profissional.comissao_percentual != null ? String(profissional.comissao_percentual) : '')
  const [dirty, setDirty] = useState(false)

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
        <input
          type="checkbox"
          checked={recebe}
          onChange={e => { setRecebe(e.target.checked); setDirty(true) }}
          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
        />
        <span className="text-sm font-medium text-slate-900 truncate">{profissional.name}</span>
      </label>

      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={pct}
          disabled={!recebe}
          onChange={e => { setPct(e.target.value); setDirty(true) }}
          placeholder="0"
          className="input w-20 text-sm text-right disabled:opacity-50 disabled:bg-slate-100"
        />
        <span className="text-sm text-slate-500">%</span>
      </div>

      <button
        onClick={() => { onSave(recebe, pct); setDirty(false) }}
        disabled={saving || !dirty}
        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-30 flex-shrink-0"
        title="Salvar"
      >
        {saving ? <LoadingSpinner size="sm" /> : <Icon name="check" className="w-4 h-4" />}
      </button>
    </div>
  )
}
