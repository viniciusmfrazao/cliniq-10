'use client'

import { useState, useMemo } from 'react'
import Icon from '@/components/ui/Icon'

type Entrada = {
  paciente_id: string | null
  paciente_nome: string | null
  valor_bruto: number
  valor_liquido: number
  data_venda: string
  procedimento_nome: string | null
}

type Props = {
  entradas: Entrada[]
}

type PacienteStats = {
  nome: string
  totalGasto: number
  visitas: number
  ticketMedio: number
  ultimaVisita: string
  procedimentos: Record<string, number>
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function HistoricoPacienteView({ entradas }: Props) {
  const [search, setSearch] = useState('')
  const [ordenar, setOrdenar] = useState<'gasto' | 'visitas' | 'ticket'>('gasto')
  const [pacienteSelecionado, setPacienteSelecionado] = useState<string | null>(null)

  const ranking = useMemo(() => {
    const mapa: Record<string, PacienteStats> = {}

    entradas.forEach(e => {
      const chave = e.paciente_nome?.toLowerCase().trim() || 'sem_nome'
      if (!mapa[chave]) {
        mapa[chave] = {
          nome: e.paciente_nome || 'Sem nome',
          totalGasto: 0,
          visitas: 0,
          ticketMedio: 0,
          ultimaVisita: '',
          procedimentos: {}
        }
      }
      const p = mapa[chave]
      p.totalGasto += Number(e.valor_bruto || 0)
      p.visitas += 1
      if (!p.ultimaVisita || e.data_venda > p.ultimaVisita) {
        p.ultimaVisita = e.data_venda
      }
      if (e.procedimento_nome) {
        p.procedimentos[e.procedimento_nome] = (p.procedimentos[e.procedimento_nome] || 0) + 1
      }
    })

    Object.values(mapa).forEach(p => {
      p.ticketMedio = p.visitas > 0 ? p.totalGasto / p.visitas : 0
    })

    return Object.values(mapa)
  }, [entradas])

  const filteredRanking = useMemo(() => {
    let list = ranking.filter(p => 
      p.nome.toLowerCase() !== 'sem nome' &&
      (!search || p.nome.toLowerCase().includes(search.toLowerCase()))
    )

    if (ordenar === 'gasto') {
      list.sort((a, b) => b.totalGasto - a.totalGasto)
    } else if (ordenar === 'visitas') {
      list.sort((a, b) => b.visitas - a.visitas)
    } else {
      list.sort((a, b) => b.ticketMedio - a.ticketMedio)
    }

    return list
  }, [ranking, search, ordenar])

  const pacienteDetalhe = pacienteSelecionado 
    ? ranking.find(p => p.nome.toLowerCase() === pacienteSelecionado.toLowerCase())
    : null

  const historicoDetalhe = pacienteSelecionado
    ? entradas.filter(e => e.paciente_nome?.toLowerCase() === pacienteSelecionado.toLowerCase())
    : []

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Icon name="search" className="w-5 h-5 text-slate-400" />
          Buscar por nome
        </h3>
        <input
          type="text"
          placeholder="Digite o nome do paciente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-lg"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Icon name="award" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Ranking de Pacientes</h3>
              <p className="text-xs text-slate-500">{filteredRanking.length} pacientes</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setOrdenar('gasto')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                ordenar === 'gasto' 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Maior gasto
            </button>
            <button
              onClick={() => setOrdenar('visitas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                ordenar === 'visitas' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Mais visitas
            </button>
            <button
              onClick={() => setOrdenar('ticket')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                ordenar === 'ticket' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Maior ticket
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Paciente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total Gasto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Visitas</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ticket Médio</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Última Visita</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRanking.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Nenhum paciente encontrado
                  </td>
                </tr>
              ) : (
                filteredRanking.slice(0, 50).map((p, idx) => (
                  <tr key={p.nome} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {idx < 3 ? (
                        <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-slate-200 text-slate-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">#{idx + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.nome}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-emerald-600">{fmt(p.totalGasto)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {p.visitas}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {fmt(p.ticketMedio)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-sm">
                      {p.ultimaVisita ? new Date(p.ultimaVisita).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setPacienteSelecionado(p.nome)}
                        className="px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 rounded-lg transition font-medium"
                      >
                        Ver histórico
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pacienteDetalhe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{pacienteDetalhe.nome}</h3>
                <p className="text-sm text-slate-500">Histórico completo</p>
              </div>
              <button
                onClick={() => setPacienteSelecionado(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <Icon name="x" className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 border-b border-slate-100 grid grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-emerald-700">{fmt(pacienteDetalhe.totalGasto)}</p>
                <p className="text-sm text-emerald-600">Total gasto</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-blue-700">{pacienteDetalhe.visitas}</p>
                <p className="text-sm text-blue-600">Visitas</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-violet-700">{fmt(pacienteDetalhe.ticketMedio)}</p>
                <p className="text-sm text-violet-600">Ticket médio</p>
              </div>
            </div>

            {Object.keys(pacienteDetalhe.procedimentos).length > 0 && (
              <div className="p-5 border-b border-slate-100">
                <h4 className="font-semibold text-slate-700 mb-3 text-sm">Procedimentos realizados</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(pacienteDetalhe.procedimentos)
                    .sort((a, b) => b[1] - a[1])
                    .map(([proc, qtd]) => (
                      <span key={proc} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
                        {proc} <span className="font-bold text-slate-700">×{qtd}</span>
                      </span>
                    ))}
                </div>
              </div>
            )}

            <div className="p-5 max-h-64 overflow-y-auto">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">Histórico de atendimentos</h4>
              <div className="space-y-2">
                {historicoDetalhe.map((e, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-medium text-slate-900">{e.procedimento_nome || 'Atendimento'}</p>
                      <p className="text-sm text-slate-500">
                        {new Date(e.data_venda).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-600">{fmt(e.valor_bruto)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
