'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Debito = {
  id: string
  paciente_id: string
  valor: number
  descricao: string
  data_vencimento: string
  data_promessa: string | null
  observacao_cobranca: string | null
  status: string
  patients: { name: string; phone: string | null } | null
}

type Paciente = {
  id: string
  name: string
  phone: string | null
}

type Props = {
  debitos: Debito[]
  pacientes: Paciente[]
  clinicId: string
  clinicName: string
}

// ─── Busca de paciente por nome/telefone/CPF ─────────────────────────────────
function PatientSearch({ clinicId, value, onChange }: {
  clinicId: string
  value: string
  onChange: (id: string, name: string) => void
}) {
  const [inputVal, setInputVal] = useState('')
  const [results, setResults] = useState<Paciente[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (inputVal.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('patients')
        .select('id, name, phone')
        .eq('clinic_id', clinicId)
        .ilike('name', `%${inputVal}%`)
        .order('name')
        .limit(10)
      setResults(data || [])
      setLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [inputVal])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputVal(e.target.value)
    setOpen(true)
    if (value) onChange('', '')
  }

  function select(p: Paciente) {
    onChange(p.id, p.name)
    setInputVal(p.name)
    setOpen(false)
  }

  function clear() {
    onChange('', '')
    setInputVal('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={inputVal}
          onChange={handleChange}
          onFocus={() => { setOpen(true) }}
          placeholder="Buscar por nome..."
          className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm"
          required={!value}
          autoComplete="new-password"
          name="patient-search-field"
        />
        {(value || inputVal) && (
          <button type="button" onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && (loading || results.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-y-auto max-h-64">
          {loading && (
            <div className="px-4 py-3 text-sm text-slate-400">Buscando...</div>
          )}
          {!loading && results.map(p => (
            <button key={p.id} type="button" onMouseDown={() => select(p)}
              className="w-full text-left px-4 py-2.5 hover:bg-violet-50 transition-colors border-b border-slate-50 last:border-0">
              <p className="text-sm font-medium text-slate-900">{p.name}</p>
              {p.phone && <p className="text-xs text-slate-400">{p.phone}</p>}
            </button>
          ))}
        </div>
      )}
      {open && !loading && inputVal.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-400">Nenhum paciente encontrado</p>
        </div>
      )}
    </div>
  )
}


function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function isHoje(iso: string | null) {
  if (!iso) return false
  return iso === todayBR()
}

function isAtrasada(iso: string | null) {
  if (!iso) return false
  return iso < todayBR()
}

export default function DevedoresList({ debitos, pacientes, clinicId, clinicName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [pagandoParcial, setPagandoParcial] = useState<Debito | null>(null)
  const [valorParcial, setValorParcial] = useState('')
  const [formaParcial, setFormaParcial] = useState('pix')
  const [editingPromessa, setEditingPromessa] = useState<string | null>(null)
  const [promessaForm, setPromessaForm] = useState({ data: '', observacao: '' })

  const [form, setForm] = useState({
    paciente_id: '',
    nome_livre: '',
    valor: '',
    descricao: '',
    data_vencimento: todayBR(),
  })
  const [tipoDevedor, setTipoDevedor] = useState<'paciente' | 'fornecedor'>('paciente')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if ((!form.paciente_id && !form.nome_livre.trim()) || !form.valor) {
      alert('Preencha o nome e o valor')
      return
    }
    setLoading(true)
    const nomeFinal = form.paciente_id
      ? pacientes.find(p => p.id === form.paciente_id)?.name || ''
      : form.nome_livre.trim()
    const { error } = await supabase.from('debitos').insert({
      clinic_id: clinicId,
      paciente_id: form.paciente_id || null,
      paciente_nome: nomeFinal,
      valor: parseFloat(form.valor),
      descricao: form.descricao || 'Débito',
      data_vencimento: form.data_vencimento,
      status: 'pendente',
    })
    if (error) { alert('Erro ao salvar: ' + error.message); setLoading(false); return }
    setForm({ paciente_id: '', nome_livre: '', valor: '', descricao: '', data_vencimento: todayBR() })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function handlePagar(id: string) {
    if (!confirm('Confirma que este débito foi pago?')) return
    setLoadingId(id)

    const debito = debitos.find(d => d.id === id)
    const hoje = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Marcar como pago com data correta
    const { error: errUpdate } = await supabase.from('debitos').update({
      status: 'pago',
      data_pagamento: hoje, // usar date, não timestamp
    }).eq('id', id)

    if (errUpdate) {
      alert('Erro ao marcar como pago: ' + errUpdate.message)
      setLoadingId(null)
      return
    }

    // Criar entrada no financeiro com a data de HOJE (data do pagamento real)
    if (debito) {
      const { error: errEntrada } = await supabase.from('entradas').insert({
        clinic_id: clinicId,
        data_venda: hoje, // data que o pagamento aconteceu de fato
        paciente_id: debito.paciente_id,
        paciente_nome: debito.patients?.name || '',
        procedimento_nome: debito.descricao,
        forma_pagamento: 'pix',
        valor_bruto: Number(debito.valor),
        taxa_percentual: 0,
        valor_taxa: 0,
        valor_liquido: Number(debito.valor),
        observacoes: `Quitação de débito${debito.data_vencimento !== hoje ? ` (vencimento: ${new Date(debito.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')})` : ''}`,
      })
      if (errEntrada) console.error('Erro ao criar entrada:', errEntrada)
    }

    setLoadingId(null)
    router.refresh()
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir este débito?')) return
    setLoadingId(id)
    await supabase.from('debitos').delete().eq('id', id)
    setLoadingId(null)
    router.refresh()
  }

  async function handlePagarParcial() {
    if (!pagandoParcial) return
    const valor = parseFloat(valorParcial)
    if (!valor || valor <= 0 || valor > pagandoParcial.valor) {
      alert(`Valor inválido. Máximo: ${Number(pagandoParcial.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
      return
    }
    setLoadingId(pagandoParcial.id)
    const hoje = new Date().toISOString().split('T')[0]
    const restante = Math.round((pagandoParcial.valor - valor) * 100) / 100

    // Criar entrada do valor pago
    await supabase.from('entradas').insert({
      clinic_id: clinicId,
      data_venda: hoje,
      paciente_id: pagandoParcial.paciente_id,
      paciente_nome: pagandoParcial.patients?.name || '',
      procedimento_nome: pagandoParcial.descricao,
      forma_pagamento: formaParcial,
      valor_bruto: valor,
      taxa_percentual: 0,
      valor_taxa: 0,
      valor_liquido: valor,
      observacoes: `Pagamento parcial de débito (restante: ${restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
    })

    if (restante > 0) {
      // Atualizar débito com novo valor restante
      const { error: errUpdate } = await supabase.from('debitos').update({
        valor: restante,
        observacoes: `Pagou ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${new Date().toLocaleDateString('pt-BR')}. Restante: ${restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      }).eq('id', pagandoParcial.id)
      if (errUpdate) {
        alert('Erro ao atualizar débito: ' + errUpdate.message)
        setLoadingId(null)
        return
      }
    } else {
      // Quitou tudo
      await supabase.from('debitos').update({ status: 'pago', data_pagamento: hoje }).eq('id', pagandoParcial.id)
    }

    setPagandoParcial(null)
    setValorParcial('')
    setLoadingId(null)
    router.refresh()
  }

  async function handleSalvarPromessa(id: string) {
    setLoadingId(id)
    await supabase.from('debitos').update({
      data_promessa: promessaForm.data || null,
      observacao_cobranca: promessaForm.observacao || null,
    }).eq('id', id)
    setEditingPromessa(null)
    setLoadingId(null)
    router.refresh()
  }

  // Alertas do dia — promessas que vencem hoje ou já venceram
  const alertasHoje = debitos.filter(d =>
    d.status === 'pendente' && d.data_promessa && (isHoje(d.data_promessa) || isAtrasada(d.data_promessa))
  )

  // Agrupar por paciente
  const debitosPorPaciente: Record<string, { paciente: string; phone: string | null; debitos: Debito[]; total: number }> = {}
  debitos.forEach(d => {
    const key = d.paciente_id
    if (!debitosPorPaciente[key]) {
      debitosPorPaciente[key] = { paciente: d.patients?.name || 'Paciente', phone: d.patients?.phone || null, debitos: [], total: 0 }
    }
    debitosPorPaciente[key].debitos.push(d)
    debitosPorPaciente[key].total += Number(d.valor || 0)
  })

  const pacientesComDebito = Object.entries(debitosPorPaciente).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="space-y-4">

      {/* Alertas de cobrança do dia */}
      {alertasHoje.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔔</span>
            <h3 className="font-bold text-amber-800">
              {alertasHoje.length} cobrança{alertasHoje.length > 1 ? 's' : ''} para hoje
            </h3>
          </div>
          <div className="space-y-2">
            {alertasHoje.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-amber-100">
                <div>
                  <span className="font-medium text-slate-900">{d.patients?.name}</span>
                  <span className="text-slate-500 text-sm ml-2">— {d.descricao}</span>
                  {d.observacao_cobranca && (
                    <p className="text-xs text-amber-700 mt-0.5">💬 {d.observacao_cobranca}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-rose-600">{fmt(d.valor)}</span>
                  {isAtrasada(d.data_promessa) && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Atrasada</span>
                  )}
                  {isHoje(d.data_promessa) && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Hoje</span>
                  )}
                  {d.patients?.phone && (() => {
                    const phone = d.patients!.phone!.replace(/\D/g, '')
                    const msg = encodeURIComponent(
                      `Olá ${d.patients!.name}! Passando para lembrar que sua conta na ${clinicName} de ${fmt(d.valor)} está em aberto (vencimento: ${fmtDate(d.data_vencimento)}). Quando puder, entre em contato para regularizar. Obrigada! 🙏`
                    )
                    return (
                      <a href={`https://wa.me/55${phone}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors">
                        <Icon name="phone" className="w-3.5 h-3.5" />
                        Cobrar via WhatsApp
                      </a>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão de adicionar */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-rose-700 transition">
          <Icon name="plus" className="w-5 h-5" />
          Registrar Débito
        </button>
      </div>

      {/* Formulário de novo débito */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Novo Débito</h3>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2 lg:col-span-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-slate-700">Quem deve?</label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                  <button type="button" onClick={() => { setTipoDevedor('paciente'); setForm(f => ({...f, nome_livre: ''})) }}
                    className={`px-3 py-1.5 transition-colors ${tipoDevedor === 'paciente' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                    Paciente
                  </button>
                  <button type="button" onClick={() => { setTipoDevedor('fornecedor'); setForm(f => ({...f, paciente_id: ''})) }}
                    className={`px-3 py-1.5 transition-colors ${tipoDevedor === 'fornecedor' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                    Fornecedor / Outro
                  </button>
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{tipoDevedor === 'paciente' ? 'Paciente *' : 'Nome do fornecedor *'}</label>
              {tipoDevedor === 'paciente' ? (
                <PatientSearch
                  clinicId={clinicId}
                  value={form.paciente_id}
                  onChange={(id, _name) => setForm({ ...form, paciente_id: id })}
                />
              ) : (
                <input
                  type="text"
                  value={form.nome_livre}
                  onChange={e => setForm({ ...form, nome_livre: e.target.value })}
                  placeholder="Ex: Vitalab, Farmácia Central..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor *</label>
              <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Procedimento X" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
              <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500" />
            </div>
            <div className="md:col-span-2 lg:col-span-4 flex gap-2">
              <button type="submit" disabled={loading}
                className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 disabled:opacity-50">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de devedores */}
      {pacientesComDebito.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="check" className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Nenhum devedor</h3>
          <p className="text-slate-500">Todos os débitos estão quitados!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pacientesComDebito.map(([pacienteId, data]) => (
            <div key={pacienteId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
                    <span className="text-rose-700 font-bold text-lg">{data.paciente.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{data.paciente}</h3>
                    {data.phone && (
                      <a href={`https://wa.me/55${data.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-emerald-600 hover:underline flex items-center gap-1">
                        <Icon name="phone" className="w-3 h-3" />
                        {data.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-rose-600">{fmt(data.total)}</p>
                  <p className="text-xs text-slate-500">{data.debitos.length} débito(s)</p>
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {data.debitos.map(debito => {
                  const isVencido = debito.data_vencimento < todayBR()
                  const isLoading = loadingId === debito.id
                  const editando = editingPromessa === debito.id

                  return (
                    <div key={debito.id} className="p-4 hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${isVencido ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <div>
                            <p className="font-medium text-slate-900">{debito.descricao}</p>
                            <p className="text-sm text-slate-500">
                              Vence: {fmtDate(debito.data_vencimento)}
                              {isVencido && <span className="text-red-500 ml-2">• Vencido</span>}
                            </p>
                            {/* Data de promessa */}
                            {debito.data_promessa && !editando && (
                              <p className={`text-xs mt-0.5 font-medium ${
                                isAtrasada(debito.data_promessa) ? 'text-red-600' :
                                isHoje(debito.data_promessa) ? 'text-amber-600' : 'text-blue-600'
                              }`}>
                                🗓️ Prometeu pagar em {fmtDate(debito.data_promessa)}
                                {debito.observacao_cobranca && ` — ${debito.observacao_cobranca}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{fmt(debito.valor)}</p>
                          {/* Botão promessa */}
                          <button
                            onClick={() => {
                              setEditingPromessa(debito.id)
                              setPromessaForm({ data: debito.data_promessa || '', observacao: debito.observacao_cobranca || '' })
                            }}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Data de promessa"
                          >
                            <Icon name="calendar" className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePagar(debito.id)} disabled={isLoading}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50" title="Marcar como pago total">
                            <Icon name="check" className="w-5 h-5" />
                          </button>
                          <button onClick={() => { setPagandoParcial(debito); setValorParcial('') }} disabled={isLoading}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50" title="Pagamento parcial">
                            <Icon name="dollarSign" className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleExcluir(debito.id)} disabled={isLoading}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Excluir">
                            <Icon name="trash" className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Form de promessa inline */}
                      {editando && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-xl flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-medium text-blue-700 mb-1">Data que prometeu pagar</label>
                            <input type="date" value={promessaForm.data}
                              onChange={e => setPromessaForm({ ...promessaForm, data: e.target.value })}
                              className="px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20" />
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs font-medium text-blue-700 mb-1">Observação</label>
                            <input type="text" value={promessaForm.observacao} placeholder="Ex: vai pagar na sexta"
                              onChange={e => setPromessaForm({ ...promessaForm, observacao: e.target.value })}
                              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20" />
                          </div>
                          <button onClick={() => handleSalvarPromessa(debito.id)} disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                            Salvar
                          </button>
                          <button onClick={() => setEditingPromessa(null)}
                            className="px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de pagamento parcial */}
      {pagandoParcial && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPagandoParcial(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-1">Pagamento parcial</h3>
            <p className="text-sm text-slate-500 mb-4">
              {pagandoParcial.patients?.name} — {pagandoParcial.descricao}
              <br />
              <span className="font-semibold text-red-600">
                Total: {Number(pagandoParcial.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Valor pago agora (R$)</label>
                <input
                  type="number"
                  value={valorParcial}
                  onChange={e => {
                    const v = e.target.value
                    // Evitar valores maiores que o débito
                    if (parseFloat(v) > pagandoParcial.valor) return
                    setValorParcial(v)
                  }}
                  max={pagandoParcial.valor}
                  min={0.01}
                  step={0.01}
                  placeholder={`Máx: ${Number(pagandoParcial.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  className="input w-full text-lg font-bold"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">
                  Total do débito: <strong>{Number(pagandoParcial.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </p>
                {valorParcial && parseFloat(valorParcial) > 0 && parseFloat(valorParcial) < pagandoParcial.valor && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Restante: <strong>
                      {(pagandoParcial.valor - parseFloat(valorParcial)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Forma de pagamento</label>
                <select value={formaParcial} onChange={e => setFormaParcial(e.target.value)} className="input w-full text-sm">
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setPagandoParcial(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handlePagarParcial} disabled={!!loadingId}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {loadingId ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

