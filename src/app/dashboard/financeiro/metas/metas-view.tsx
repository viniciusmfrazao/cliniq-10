'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

type Meta = {
  id: string
  mes: string
  meta_receita: number
  meta_atendimentos: number | null
}

type Props = {
  metas: Meta[]
  receitaMesAtual: number
  atendimentosMesAtual: number
  clinicId: string
  currentMonth: string
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function getMesLabel(mes: string) {
  const [year, month] = mes.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(month) - 1]}/${year.slice(2)}`
}

export default function MetasView({ metas, receitaMesAtual, atendimentosMesAtual, clinicId, currentMonth }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [mes, setMes] = useState(currentMonth)
  const [metaReceita, setMetaReceita] = useState('')
  const [metaAtendimentos, setMetaAtendimentos] = useState('')

  const metaAtual = metas.find(m => m.mes === currentMonth)
  const pctReceita = metaAtual?.meta_receita 
    ? Math.min(100, Math.round((receitaMesAtual / metaAtual.meta_receita) * 100))
    : 0
  const pctAtendimentos = metaAtual?.meta_atendimentos 
    ? Math.min(100, Math.round((atendimentosMesAtual / metaAtual.meta_atendimentos) * 100))
    : 0

  const faltaReceita = metaAtual?.meta_receita 
    ? Math.max(0, metaAtual.meta_receita - receitaMesAtual)
    : 0
  const faltaAtendimentos = metaAtual?.meta_atendimentos 
    ? Math.max(0, metaAtual.meta_atendimentos - atendimentosMesAtual)
    : 0

  async function handleSalvar() {
    const valorReceita = parseFloat(metaReceita)
    const valorAtendimentos = parseInt(metaAtendimentos) || null

    if (!valorReceita || valorReceita <= 0) {
      alert('Informe a meta de receita')
      return
    }

    setLoading(true)

    const existente = metas.find(m => m.mes === mes)

    if (existente) {
      const { error } = await supabase
        .from('metas_financeiras')
        .update({ 
          meta_receita: valorReceita,
          meta_atendimentos: valorAtendimentos
        })
        .eq('id', existente.id)

      if (error) {
        alert('Erro ao atualizar: ' + error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('metas_financeiras')
        .insert({
          clinic_id: clinicId,
          mes,
          meta_receita: valorReceita,
          meta_atendimentos: valorAtendimentos
        })

      if (error) {
        alert('Erro ao salvar: ' + error.message)
        setLoading(false)
        return
      }
    }

    setMetaReceita('')
    setMetaAtendimentos('')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Icon name="edit" className="w-5 h-5 text-violet-600" />
            Cadastrar / editar meta
          </h3>
          <p className="text-sm text-slate-500 mb-4">Defina o faturamento que quer atingir no mês</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mês</label>
              <input
                type="month"
                value={mes}
                onChange={e => setMes(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meta de receita (R$)</label>
              <input
                type="number"
                step="1000"
                min="0"
                value={metaReceita}
                onChange={e => setMetaReceita(e.target.value)}
                placeholder="Ex: 50000"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meta de atendimentos (opcional)</label>
              <input
                type="number"
                min="0"
                value={metaAtendimentos}
                onChange={e => setMetaAtendimentos(e.target.value)}
                placeholder="Ex: 80"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            <button
              onClick={handleSalvar}
              disabled={loading}
              className="w-full px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Icon name="loader" className="w-5 h-5 animate-spin" />
              ) : (
                <Icon name="check" className="w-5 h-5" />
              )}
              Salvar Meta
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/80 text-sm">Mês Atual</p>
                <p className="text-2xl font-black">{getMesLabel(currentMonth)}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black">{pctReceita}%</p>
                <p className="text-white/80 text-sm">da meta</p>
              </div>
            </div>

            {metaAtual ? (
              <>
                <div className="h-4 bg-white/20 rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${pctReceita}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-white/80">Realizado</p>
                    <p className="font-bold">{fmt(receitaMesAtual)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/80">Meta</p>
                    <p className="font-bold">{fmt(metaAtual.meta_receita)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/80">Faltam</p>
                    <p className="font-bold">{fmt(faltaReceita)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-white/80">Nenhuma meta cadastrada para este mês</p>
                <p className="text-sm text-white/60 mt-1">Cadastre uma meta ao lado</p>
              </div>
            )}
          </div>

          {metaAtual?.meta_atendimentos && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-700">Meta de Atendimentos</p>
                <span className="text-lg font-bold text-blue-600">{pctAtendimentos}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                  style={{ width: `${pctAtendimentos}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>{atendimentosMesAtual} realizados</span>
                <span>Meta: {metaAtual.meta_atendimentos}</span>
                <span>Faltam: {faltaAtendimentos}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {metas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Histórico de Metas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Mês</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Meta Receita</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Meta Atendimentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metas.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {getMesLabel(m.mes)}
                      {m.mes === currentMonth && (
                        <span className="ml-2 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full">
                          Atual
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                      {fmt(m.meta_receita)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">
                      {m.meta_atendimentos || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
