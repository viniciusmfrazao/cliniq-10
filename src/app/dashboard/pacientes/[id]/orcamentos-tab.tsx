'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Item = { id?: string; descricao: string; quantidade: number; valor_unitario: number }
type Orcamento = {
  id: string
  titulo: string
  status: string
  valido_ate: string | null
  observacoes: string | null
  created_at: string
  whatsapp_sent_at: string | null
  orcamento_itens: Item[]
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', expirado: 'Expirado',
}
const STATUS_COLOR: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-emerald-100 text-emerald-700',
  recusado: 'bg-red-100 text-red-700',
  expirado: 'bg-slate-100 text-slate-500',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function total(itens: Item[]) {
  return itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
}

export default function OrcamentosTab({
  patientId,
  clinicId,
  patientName,
  patientPhone,
  clinicName,
  initialOrcamentos,
}: {
  patientId: string
  clinicId: string
  patientName: string
  patientPhone: string | null
  clinicName: string
  initialOrcamentos: Orcamento[]
}) {
  const supabase = createClient()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(initialOrcamentos)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [form, setForm] = useState({
    titulo: 'Orçamento',
    valido_ate: '',
    observacoes: '',
    itens: [{ descricao: '', quantidade: 1, valor_unitario: 0 }] as Item[],
  })

  // Estado do modal de envio
  const [sendModal, setSendModal] = useState<{ orc: Orcamento } | null>(null)
  const [mensagemGerada, setMensagemGerada] = useState('')
  const [gerando, setGerando] = useState(false)
  const [sending, setSending] = useState(false)

  function addItem() {
    setForm(p => ({ ...p, itens: [...p.itens, { descricao: '', quantidade: 1, valor_unitario: 0 }] }))
  }
  function removeItem(i: number) {
    setForm(p => ({ ...p, itens: p.itens.filter((_, idx) => idx !== i) }))
  }
  function updateItem(i: number, field: keyof Item, val: string | number) {
    setForm(p => {
      const itens = [...p.itens]
      itens[i] = { ...itens[i], [field]: val }
      return { ...p, itens }
    })
  }

  async function handleSave() {
    if (!form.titulo.trim() || form.itens.some(i => !i.descricao.trim())) return
    setSaving(true)
    const { data: orc, error } = await supabase.from('orcamentos').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      titulo: form.titulo,
      valido_ate: form.valido_ate || null,
      observacoes: form.observacoes || null,
    }).select().single()

    if (!error && orc) {
      await supabase.from('orcamento_itens').insert(
        form.itens.map(i => ({ orcamento_id: orc.id, ...i }))
      )
      const newOrc: Orcamento = { ...orc, orcamento_itens: form.itens }
      setOrcamentos(p => [newOrc, ...p])
      setShowForm(false)
      setExpandedId(orc.id)
      setForm({ titulo: 'Orçamento', valido_ate: '', observacoes: '', itens: [{ descricao: '', quantidade: 1, valor_unitario: 0 }] })
    }
    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('orcamentos').update({ status }).eq('id', id)
    setOrcamentos(p => p.map(o => o.id === id ? { ...o, status } : o))
  }

  async function deleteOrcamento(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    await supabase.from('orcamentos').delete().eq('id', id)
    setOrcamentos(p => p.filter(o => o.id !== id))
  }

  // Abre modal e gera mensagem automaticamente
  async function abrirModalEnvio(orc: Orcamento) {
    if (!patientPhone) return alert('Paciente sem telefone cadastrado.')
    // Montar mensagem padrão como fallback
    const t = total(orc.orcamento_itens)
    const itensText = orc.orcamento_itens.map(i =>
      `• ${i.descricao} (${i.quantidade}x) — ${fmt(i.quantidade * i.valor_unitario)}`
    ).join('\n')
    const msgPadrao = `Olá ${patientName.split(' ')[0]}! 😊\n\nSegue o orçamento da ${clinicName}:\n\n*${orc.titulo}*\n\n${itensText}\n\n*Total: ${fmt(t)}*${orc.valido_ate ? `\nVálido até: ${new Date(orc.valido_ate + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}\n\nQualquer dúvida, estamos à disposição! 🤍`
    setMensagemGerada(msgPadrao)
    setSendModal({ orc })
    // Gerar mensagem com IA automaticamente
    setGerando(true)
    try {
      const res = await fetch('/api/orcamento/gerar-mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orcamentoId: orc.id }),
      })
      const data = await res.json()
      if (data.ok && data.mensagem) {
        setMensagemGerada(data.mensagem)
      }
    } catch {
      // mantém mensagem padrão
    } finally {
      setGerando(false)
    }
  }

  async function gerarNovamente() {
    if (!sendModal) return
    setGerando(true)
    try {
      const res = await fetch('/api/orcamento/gerar-mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orcamentoId: sendModal.orc.id }),
      })
      const data = await res.json()
      if (data.ok && data.mensagem) setMensagemGerada(data.mensagem)
    } catch {
      // mantém atual
    } finally {
      setGerando(false)
    }
  }

  async function confirmarEnvio() {
    if (!sendModal || !patientPhone || !mensagemGerada.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/orcamento/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orcamentoId: sendModal.orc.id, mensagemCustom: mensagemGerada }),
      })
      const data = await res.json()
      if (data.ok) {
        setOrcamentos(prev => prev.map(o => o.id === sendModal.orc.id
          ? { ...o, whatsapp_sent_at: new Date().toISOString() }
          : o
        ))
        setSendModal(null)
      } else {
        // Fallback: WhatsApp Web
        const phone = patientPhone.replace(/\D/g, '')
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(mensagemGerada)}`, '_blank')
        setSendModal(null)
      }
    } catch {
      alert('Erro ao enviar. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  const totalForm = total(form.itens)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white">Orçamentos</h3>
          <p className="text-sm text-slate-500">{orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors flex-shrink-0">
          <Icon name="plus" className="w-4 h-4" />
          <span className="hidden sm:inline">Novo orçamento</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Form novo orçamento */}
      {showForm && (
        <div className="card p-5 border-violet-200 bg-violet-50/30 dark:bg-violet-900/10">
          <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Novo Orçamento</h4>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Título</label>
              <input type="text" value={form.titulo}
                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                placeholder="ex: Harmonização Facial" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Válido até</label>
              <input type="date" value={form.valido_ate}
                onChange={e => setForm(p => ({ ...p, valido_ate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
            </div>
          </div>

          {/* Itens */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Itens</label>
              <button onClick={addItem} className="text-xs text-violet-600 font-semibold hover:underline">+ Adicionar item</button>
            </div>
            <div className="space-y-2">
              {form.itens.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input type="text" value={item.descricao}
                    onChange={e => updateItem(i, 'descricao', e.target.value)}
                    placeholder="Procedimento / produto"
                    className="col-span-6 px-3 py-2 border border-slate-200 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                  <input type="number" value={item.quantidade} min={1}
                    onChange={e => updateItem(i, 'quantidade', Number(e.target.value))}
                    className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                  <input type="number" value={item.valor_unitario} min={0} step={0.01}
                    onChange={e => updateItem(i, 'valor_unitario', Number(e.target.value))}
                    placeholder="R$ 0,00"
                    className="col-span-3 px-3 py-2 border border-slate-200 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                  <button onClick={() => removeItem(i)} className="col-span-1 flex justify-center text-slate-400 hover:text-red-500">
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Observações</label>
            <textarea value={form.observacoes} rows={2}
              onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              placeholder="Condições, forma de pagamento, etc." />
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              Total: <span className="text-violet-600">{fmt(totalForm)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : 'Salvar orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de orçamentos */}
      {orcamentos.length === 0 && !showForm ? (
        <div className="text-center py-12 text-slate-400">
          <Icon name="dollarSign" className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500">Nenhum orçamento criado</p>
          <p className="text-sm mt-1">Clique em "Novo orçamento" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orcamentos.map(orc => {
            const expanded = expandedId === orc.id
            const t = total(orc.orcamento_itens)
            return (
              <div key={orc.id} className="card overflow-hidden">
                {/* Header do orçamento */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : orc.id)}
                >
                  <Icon name={expanded ? 'chevronDown' : 'chevronRight'} className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white">{orc.titulo}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[orc.status]}`}>
                        {STATUS_LABEL[orc.status]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(orc.created_at).toLocaleDateString('pt-BR')}
                      {orc.valido_ate && ` · Válido até ${new Date(orc.valido_ate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-900 dark:text-white">{fmt(t)}</div>
                    <div className="text-xs text-slate-500">{orc.orcamento_itens.length} item{orc.orcamento_itens.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {expanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                    <table className="w-full mt-3 text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase tracking-wider">
                          <th className="text-left pb-2">Descrição</th>
                          <th className="text-center pb-2 w-16">Qtd</th>
                          <th className="text-right pb-2 w-28">Valor unit.</th>
                          <th className="text-right pb-2 w-28">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {orc.orcamento_itens.map((item, i) => (
                          <tr key={i}>
                            <td className="py-2 text-slate-800 dark:text-slate-200">{item.descricao}</td>
                            <td className="py-2 text-center text-slate-600 dark:text-slate-400">{item.quantidade}</td>
                            <td className="py-2 text-right text-slate-600 dark:text-slate-400">{fmt(item.valor_unitario)}</td>
                            <td className="py-2 text-right font-semibold text-slate-900 dark:text-white">{fmt(item.quantidade * item.valor_unitario)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td colSpan={3} className="pt-3 text-slate-700 dark:text-slate-300">Total</td>
                          <td className="pt-3 text-right text-violet-600">{fmt(t)}</td>
                        </tr>
                      </tbody>
                    </table>

                    {orc.observacoes && (
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300">
                        {orc.observacoes}
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {orc.status === 'pendente' && (
                        <>
                          <button onClick={() => updateStatus(orc.id, 'aprovado')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors">
                            <Icon name="check" className="w-3.5 h-3.5" /> Aprovado
                          </button>
                          <button onClick={() => updateStatus(orc.id, 'recusado')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors">
                            <Icon name="x" className="w-3.5 h-3.5" /> Recusado
                          </button>
                        </>
                      )}
                      {orc.status !== 'pendente' && (
                        <button onClick={() => updateStatus(orc.id, 'pendente')}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg hover:border-slate-400 transition-colors">
                          Reabrir
                        </button>
                      )}
                      <button onClick={() => abrirModalEnvio(orc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors">
                        <Icon name="phone" className="w-3.5 h-3.5" />
                        {orc.whatsapp_sent_at ? 'Reenviar WhatsApp' : 'Enviar WhatsApp'}
                      </button>
                      <button onClick={() => deleteOrcamento(orc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-red-500 text-xs rounded-lg transition-colors ml-auto">
                        <Icon name="trash" className="w-3.5 h-3.5" /> Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de envio com mensagem campeã */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Enviar por WhatsApp</h3>
                <p className="text-xs text-slate-500 mt-0.5">{sendModal.orc.titulo}</p>
              </div>
              <button onClick={() => setSendModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-5 space-y-4">
              {/* Badge IA */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    ✨ Mensagem gerada por IA
                  </span>
                  {gerando && (
                    <span className="text-xs text-slate-400 animate-pulse">gerando...</span>
                  )}
                </div>
                <button
                  onClick={gerarNovamente}
                  disabled={gerando}
                  className="text-xs text-violet-600 hover:text-violet-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Icon name="refresh" className="w-3 h-3" />
                  Gerar outra
                </button>
              </div>

              {/* Textarea editável */}
              <div className="relative">
                <textarea
                  value={mensagemGerada}
                  onChange={e => setMensagemGerada(e.target.value)}
                  rows={10}
                  disabled={gerando}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-200 dark:bg-slate-700 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none disabled:opacity-50 font-mono leading-relaxed"
                  placeholder="Gerando mensagem..."
                />
                <p className="text-xs text-slate-400 mt-1">Edite livremente antes de enviar.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 pb-5">
              <button
                onClick={() => setSendModal(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEnvio}
                disabled={sending || gerando || !mensagemGerada.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="phone" className="w-4 h-4" />
                {sending ? 'Enviando...' : 'Enviar agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
