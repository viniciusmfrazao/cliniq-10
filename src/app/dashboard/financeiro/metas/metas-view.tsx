'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'

type Meta = {
  id: string
  periodo_tipo: 'mensal' | 'semanal'
  periodo_inicio: string
  tipo: 'faturamento' | 'atendimentos' | 'procedimento' | 'novos_pacientes'
  profissional_id: string | null
  procedimento_id: string | null
  valor_meta: number
  atingida_em: string | null
}

type Entrada = {
  data_venda: string
  valor_liquido: number
  procedimento_id: string | null
  profissional_id: string | null
}

type Procedure = { id: string; name: string }
type Profissional = { id: string; name: string }

type Props = {
  metas: Meta[]
  entradas: Entrada[]
  novosPacientesCount: number
  procedures: Procedure[]
  profissionais: Profissional[]
  clinicId: string
  currentMonth: string
  currentWeekStart: string
}

const TIPO_LABEL: Record<Meta['tipo'], string> = {
  faturamento: 'Faturamento',
  atendimentos: 'Nº de atendimentos',
  procedimento: 'Procedimento específico',
  novos_pacientes: 'Novos pacientes',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function getMesLabel(mes: string) {
  const [year, month] = mes.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(month) - 1]}/${year.slice(2)}`
}

function getWeekLabel(inicio: string) {
  const start = new Date(inicio + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmtDay = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${fmtDay(start)}–${fmtDay(end)}`
}

function periodoFim(m: Meta) {
  const start = new Date(m.periodo_inicio + 'T00:00:00')
  if (m.periodo_tipo === 'semanal') {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return end.toISOString().slice(0, 10)
  }
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  return end.toISOString().slice(0, 10)
}

export default function MetasView({ metas, entradas, novosPacientesCount, procedures, profissionais, clinicId, currentMonth, currentWeekStart }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [periodoTipo, setPeriodoTipo] = useState<'mensal' | 'semanal'>('mensal')
  const [periodoInicio, setPeriodoInicio] = useState(currentMonth)
  const [tipo, setTipo] = useState<Meta['tipo']>('faturamento')
  const [valorMeta, setValorMeta] = useState('')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')

  // Metas ativas agora: do mês corrente (se mensal) ou da semana corrente (se semanal)
  const metasAtivas = useMemo(() => {
    return metas.filter(m =>
      (m.periodo_tipo === 'mensal' && m.periodo_inicio.slice(0, 7) === currentMonth) ||
      (m.periodo_tipo === 'semanal' && m.periodo_inicio === currentWeekStart)
    )
  }, [metas, currentMonth, currentWeekStart])

  function realizadoDe(m: Meta) {
    const fim = periodoFim(m)
    if (m.tipo === 'novos_pacientes') return novosPacientesCount

    const relevantes = entradas.filter(e =>
      e.data_venda >= m.periodo_inicio && e.data_venda <= fim &&
      (!m.profissional_id || e.profissional_id === m.profissional_id) &&
      (m.tipo !== 'procedimento' || e.procedimento_id === m.procedimento_id)
    )

    if (m.tipo === 'faturamento') return relevantes.reduce((s, e) => s + Number(e.valor_liquido || 0), 0)
    return relevantes.length // atendimentos ou procedimento
  }

  async function handleSalvar() {
    const valor = parseFloat(valorMeta)
    if (!valor || valor <= 0) {
      alert('Informe o valor da meta')
      return
    }
    if (tipo === 'procedimento' && !procedimentoId) {
      alert('Selecione o procedimento')
      return
    }

    setLoading(true)

    const inicioDate = periodoTipo === 'mensal'
      ? (periodoInicio.length === 7 ? periodoInicio + '-01' : periodoInicio)
      : periodoInicio

    const existente = metas.find(m =>
      m.periodo_tipo === periodoTipo &&
      (periodoTipo === 'mensal' ? m.periodo_inicio.slice(0, 7) === periodoInicio : m.periodo_inicio === periodoInicio) &&
      m.tipo === tipo &&
      (m.profissional_id || '') === (profissionalId || '') &&
      (m.procedimento_id || '') === (tipo === 'procedimento' ? procedimentoId : '')
    )

    const payload = {
      periodo_tipo: periodoTipo,
      periodo_inicio: inicioDate,
      tipo,
      profissional_id: profissionalId || null,
      procedimento_id: tipo === 'procedimento' ? procedimentoId : null,
      valor_meta: valor,
    }

    const { error } = existente
      ? await supabase.from('metas_config').update(payload).eq('id', existente.id)
      : await supabase.from('metas_config').insert({ clinic_id: clinicId, ...payload })

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setLoading(false)
      return
    }

    setValorMeta('')
    setProcedimentoId('')
    setProfissionalId('')
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

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPeriodoTipo('mensal')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${periodoTipo === 'mensal' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600'}`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setPeriodoTipo('semanal')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${periodoTipo === 'semanal' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600'}`}
              >
                Semanal
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {periodoTipo === 'mensal' ? 'Mês' : 'Semana (segunda-feira de início)'}
              </label>
              {periodoTipo === 'mensal' ? (
                <input
                  type="month"
                  value={periodoInicio}
                  onChange={e => setPeriodoInicio(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              ) : (
                <input
                  type="date"
                  value={periodoInicio.length === 7 ? currentWeekStart : periodoInicio}
                  onChange={e => setPeriodoInicio(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              )}
              {periodoTipo === 'semanal' && (
                <p className="text-xs text-slate-400 mt-1">Escolha a segunda-feira da semana desejada</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de meta</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as Meta['tipo'])}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              >
                {Object.entries(TIPO_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>

            {tipo === 'procedimento' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Procedimento</label>
                <select
                  value={procedimentoId}
                  onChange={e => setProcedimentoId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                >
                  <option value="">Selecione...</option>
                  {procedures.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {tipo !== 'novos_pacientes' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Profissional (opcional)</label>
                <select
                  value={profissionalId}
                  onChange={e => setProfissionalId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                >
                  <option value="">Meta da clínica (todos)</option>
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {tipo === 'faturamento' ? 'Meta (R$)' : 'Meta (quantidade)'}
              </label>
              <input
                type="number"
                step={tipo === 'faturamento' ? '1000' : '1'}
                min="0"
                value={valorMeta}
                onChange={e => setValorMeta(e.target.value)}
                placeholder={tipo === 'faturamento' ? 'Ex: 50000' : 'Ex: 20'}
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
          {metasAtivas.length === 0 && (
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white text-center py-8">
              <p className="text-white/80">Nenhuma meta ativa para o período atual</p>
              <p className="text-sm text-white/60 mt-1">Cadastre uma meta ao lado</p>
            </div>
          )}

          {metasAtivas.map(m => {
            const realizado = realizadoDe(m)
            const pct = m.valor_meta ? Math.min(100, Math.round((realizado / m.valor_meta) * 100)) : 0
            const falta = Math.max(0, m.valor_meta - realizado)
            const isMoeda = m.tipo === 'faturamento'
            const profNome = m.profissional_id ? profissionais.find(p => p.id === m.profissional_id)?.name : null
            const procNome = m.procedimento_id ? procedures.find(p => p.id === m.procedimento_id)?.name : null

            return (
              <div key={m.id} className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white/80 text-sm">
                      {TIPO_LABEL[m.tipo]}
                      {profNome ? ` · ${profNome}` : ''}
                      {procNome ? ` · ${procNome}` : ''}
                    </p>
                    <p className="text-lg font-black">
                      {m.periodo_tipo === 'mensal' ? getMesLabel(m.periodo_inicio.slice(0, 7)) : getWeekLabel(m.periodo_inicio)}
                    </p>
                  </div>
                  <div style={{ width: 64, height: 64 }} className="relative flex-shrink-0">
                    <ResponsiveContainer>
                      <RadialBarChart
                        innerRadius="70%"
                        outerRadius="100%"
                        data={[{ value: pct }]}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar
                          background={{ fill: 'rgba(255,255,255,0.2)' }}
                          dataKey="value"
                          cornerRadius={8}
                          fill="#ffffff"
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-base font-black">{pct}%</span>
                      {m.atingida_em && <span className="text-xs">🎉</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <p className="text-white/80">Realizado</p>
                    <p className="font-bold">{isMoeda ? fmt(realizado) : realizado}</p>
                  </div>
                  <div>
                    <p className="text-white/80">Meta</p>
                    <p className="font-bold">{isMoeda ? fmt(m.valor_meta) : m.valor_meta}</p>
                  </div>
                  <div>
                    <p className="text-white/80">Faltam</p>
                    <p className="font-bold">{isMoeda ? fmt(falta) : falta}</p>
                  </div>
                </div>
              </div>
            )
          })}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Período</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Detalhe</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Meta</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metas.map(m => {
                  const profNome = m.profissional_id ? profissionais.find(p => p.id === m.profissional_id)?.name : null
                  const procNome = m.procedimento_id ? procedures.find(p => p.id === m.procedimento_id)?.name : null
                  const isAtiva = metasAtivas.some(a => a.id === m.id)
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {m.periodo_tipo === 'mensal' ? getMesLabel(m.periodo_inicio.slice(0, 7)) : getWeekLabel(m.periodo_inicio)}
                        {isAtiva && (
                          <span className="ml-2 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full">
                            Atual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{TIPO_LABEL[m.tipo]}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{profNome || procNome || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                        {m.tipo === 'faturamento' ? fmt(m.valor_meta) : m.valor_meta}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.atingida_em ? (
                          <span className="text-emerald-600 text-sm">🎉 Batida</span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
