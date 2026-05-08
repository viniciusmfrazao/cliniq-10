'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'

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
  const [editingPromessa, setEditingPromessa] = useState<string | null>(null)
  const [promessaForm, setPromessaForm] = useState({ data: '', observacao: '' })

  const [form, setForm] = useState({
    paciente_id: '',
    valor: '',
    descricao: '',
    data_vencimento: todayBR(),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id || !form.valor) {
      alert('Preencha paciente e valor')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('debitos').insert({
      clinic_id: clinicId,
      paciente_id: form.paciente_id,
      valor: parseFloat(form.valor),
      descricao: form.descricao || 'Débito',
      data_vencimento: form.data_vencimento,
      status: 'pendente',
    })
    if (error) { alert('Erro ao salvar: ' + error.message); setLoading(false); return }
    setForm({ paciente_id: '', valor: '', descricao: '', data_vencimento: todayBR() })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function handlePagar(id: string) {
    if (!confirm('Confirma que este débito foi pago?')) return
    setLoadingId(id)
    await supabase.from('debitos').update({ status: 'pago', data_pagamento: new Date().toISOString() }).eq('id', id)
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
                  {d.phone && (
                    <a href={`https://wa.me/55${d.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                      <Icon name="phone" className="w-4 h-4" />
                    </a>
                  )}
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paciente *</label>
              <select value={form.paciente_id} onChange={e => setForm({ ...form, paciente_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500" required>
                <option value="">Selecione</option>
                {pacientes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
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
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50" title="Marcar como pago">
                            <Icon name="check" className="w-5 h-5" />
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
    </div>
  )
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
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function DevedoresList({ debitos, pacientes, clinicId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    paciente_id: '',
    valor: '',
    descricao: '',
    data_vencimento: todayBR(),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id || !form.valor) {
      alert('Preencha paciente e valor')
      return
    }
    
    setLoading(true)
    
    const { error } = await supabase.from('debitos').insert({
      clinic_id: clinicId,
      paciente_id: form.paciente_id,
      valor: parseFloat(form.valor),
      descricao: form.descricao || 'Débito',
      data_vencimento: form.data_vencimento,
      status: 'pendente',
    })

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setLoading(false)
      return
    }

    setForm({ paciente_id: '', valor: '', descricao: '', data_vencimento: todayBR() })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function handlePagar(id: string) {
    if (!confirm('Confirma que este débito foi pago?')) return
    
    setLoadingId(id)
    
    await supabase
      .from('debitos')
      .update({ status: 'pago', data_pagamento: new Date().toISOString() })
      .eq('id', id)
    
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

  // Agrupar por paciente
  const debitosPorPaciente: Record<string, { paciente: string; phone: string | null; debitos: Debito[]; total: number }> = {}
  
  debitos.forEach(d => {
    const key = d.paciente_id
    if (!debitosPorPaciente[key]) {
      debitosPorPaciente[key] = {
        paciente: d.patients?.name || 'Paciente',
        phone: d.patients?.phone || null,
        debitos: [],
        total: 0,
      }
    }
    debitosPorPaciente[key].debitos.push(d)
    debitosPorPaciente[key].total += Number(d.valor || 0)
  })

  const pacientesComDebito = Object.entries(debitosPorPaciente).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="space-y-4">
      {/* Botão de adicionar */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-rose-700 transition"
        >
          <Icon name="plus" className="w-5 h-5" />
          Registrar Débito
        </button>
      </div>

      {/* Formulário de novo débito */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Novo Débito</h3>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paciente *</label>
              <select
                value={form.paciente_id}
                onChange={e => setForm({ ...form, paciente_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              >
                <option value="">Selecione</option>
                {pacientes.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor *</label>
              <input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={e => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input
                type="text"
                value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Procedimento X"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
              <input
                type="date"
                value={form.data_vencimento}
                onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            
            <div className="md:col-span-2 lg:col-span-4 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
              >
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
              {/* Header do paciente */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
                    <span className="text-rose-700 font-bold text-lg">
                      {data.paciente.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{data.paciente}</h3>
                    {data.phone && (
                    <a
                      href={`https://wa.me/55${data.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${data.paciente.split(' ')[0]}! Tudo bem? 😊\n\nPassando aqui da ${clinicName} para confirmar se está tudo certo com o pagamento pendente de ${fmt(data.total)}.\n\nQualquer dúvida estou à disposição! 🙏`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      <Icon name="phone" className="w-3.5 h-3.5" />
                      Cobrar via WhatsApp
                    </a>
                  )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-rose-600">{fmt(data.total)}</p>
                  <p className="text-xs text-slate-500">{data.debitos.length} débito(s)</p>
                </div>
              </div>

              {/* Lista de débitos do paciente */}
              <div className="divide-y divide-slate-50">
                {data.debitos.map(debito => {
                  const isVencido = new Date(debito.data_vencimento) < new Date()
                  const isLoading = loadingId === debito.id
                  
                  return (
                    <div key={debito.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${isVencido ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <div>
                          <p className="font-medium text-slate-900">{debito.descricao}</p>
                          <p className="text-sm text-slate-500">
                            Vence em: {new Date(debito.data_vencimento).toLocaleDateString('pt-BR')}
                            {isVencido && <span className="text-red-500 ml-2">• Vencido</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-slate-900">{fmt(debito.valor)}</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handlePagar(debito.id)}
                            disabled={isLoading}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Marcar como pago"
                          >
                            <Icon name="check" className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleExcluir(debito.id)}
                            disabled={isLoading}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Icon name="trash" className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
