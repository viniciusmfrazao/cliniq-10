'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

const DEFAULT_TEMPLATE = `Oi {{primeiro_nome}}! 💜

Que bom te ver de novo na {{clinica}} para o seu retorno! Ficamos muito felizes com o seu progresso.

Qualquer coisa que precisar, é só chamar por aqui. 🤍`

const DEFAULT_SEQ_TEMPLATES = [
  `Oi {{primeiro_nome}}! 😊

Passando pra saber como você está se sentindo após o seu retorno na {{clinica}}. Está tudo certinho?

Qualquer dúvida é só chamar. 💜`,
  `Oi {{primeiro_nome}}! 🌟

Já pensou em agendar sua próxima sessão? Estamos sempre aqui pra te receber na {{clinica}}! 💜`,
]

interface SeqItem {
  valor: number
  unidade: 'dias' | 'horas'
  ativo: boolean
  template: string
}

interface Initial {
  enabled: boolean
  hora: number
  template: string | null
  seq: SeqItem[]
}

interface Props {
  clinicId: string
  clinicName: string
  initial: Initial
}

export default function PosVendaForm({ clinicId, clinicName, initial }: Props) {
  const supabase = createClient()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [hora, setHora] = useState(initial.hora)
  const [template, setTemplate] = useState(initial.template || DEFAULT_TEMPLATE)
  const [seq, setSeq] = useState<SeqItem[]>(
    initial.seq?.length > 0 ? initial.seq : []
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMsgIdx, setTestMsgIdx] = useState<number>(-1) // -1 = mensagem principal
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const horaLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

  const preview = template
    .replace(/\{\{primeiro_nome\}\}/g, 'Ana')
    .replace(/\{\{nome\}\}/g, 'Ana Silva')
    .replace(/\{\{procedimento\}\}/g, 'Retorno')
    .replace(/\{\{profissional\}\}/g, 'Dra. Ana')
    .replace(/\{\{clinica\}\}/g, clinicName)

  function addSeq() {
    const last = seq[seq.length - 1]
    const nextValor = !last ? 7 : (last.unidade === 'dias' ? last.valor + 7 : last.valor + 3)
    setSeq([...seq, {
      valor: nextValor,
      unidade: 'dias',
      ativo: true,
      template: DEFAULT_SEQ_TEMPLATES[Math.min(seq.length, DEFAULT_SEQ_TEMPLATES.length - 1)],
    }])
  }

  function removeSeq(idx: number) {
    setSeq(seq.filter((_, i) => i !== idx))
  }

  function updateSeq(idx: number, patch: Partial<SeqItem>) {
    setSeq(seq.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function renderTestVars(tpl: string): string {
    return tpl
      .replace(/\{\{primeiro_nome\}\}/g, 'Ana')
      .replace(/\{\{nome\}\}/g, 'Ana Silva')
      .replace(/\{\{procedimento\}\}/g, 'Retorno')
      .replace(/\{\{profissional\}\}/g, 'Dra. Ana')
      .replace(/\{\{clinica\}\}/g, clinicName)
  }

  async function sendTest() {
    if (!testPhone.trim()) {
      setTestMsg({ kind: 'err', text: 'Informe um número com DDD (ex: 5534999999999)' })
      return
    }
    const tplRaw = testMsgIdx === -1 ? template : (seq[testMsgIdx]?.template ?? '')
    if (!tplRaw.trim()) {
      setTestMsg({ kind: 'err', text: 'A mensagem selecionada está vazia.' })
      return
    }
    setTesting(true); setTestMsg(null)
    try {
      const text = renderTestVars(tplRaw)
      const r = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: text, purpose: 'automation' }),
      })
      const json = await r.json()
      if (json.ok) setTestMsg({ kind: 'ok', text: 'Mensagem de teste enviada!' })
      else setTestMsg({ kind: 'err', text: json.error || 'Erro ao enviar' })
    } catch { setTestMsg({ kind: 'err', text: 'Erro de conexão' }) }
    finally { setTesting(false) }
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('clinic_automations').upsert({
      clinic_id: clinicId,
      pos_venda_ativo: enabled,
      pos_venda_hora: hora,
      template_pos_venda: template,
      pos_venda_seq: seq,
    }, { onConflict: 'clinic_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-6 space-y-5">

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800">Ativar pós-venda</p>
          <p className="text-sm text-slate-500">Envia mensagens automaticamente quando um retorno é concluído</p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(p => !p)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Aviso obrigatório: precisa existir procedimento "Retorno" */}
      <div className="p-4 bg-amber-50 rounded-xl text-sm text-amber-800 border border-amber-200">
        <p className="font-semibold mb-1 flex items-center gap-1">
          <Icon name="alertCircle" className="w-4 h-4" /> Atenção: pré-requisito
        </p>
        <p>
          Para o pós-venda funcionar, sua clínica precisa ter um <strong>procedimento cadastrado com o nome &quot;Retorno&quot;</strong>.
          A automação só é disparada quando um agendamento desse procedimento é marcado como <strong>concluído</strong>.
        </p>
      </div>

      {enabled && (
        <>
          {/* Como funciona */}
          <div className="p-4 bg-violet-50 rounded-xl text-sm text-violet-700 border border-violet-100">
            <p className="font-semibold mb-1 flex items-center gap-1"><Icon name="info" className="w-4 h-4" /> Como funciona</p>
            <p>Todo dia às <strong>{horaLabel(hora)}</strong>, o sistema verifica quem teve um <strong>Retorno concluído no dia anterior</strong> e envia a mensagem automaticamente.</p>
          </div>

          {/* Horário */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Horário de envio</label>
            <select value={hora} onChange={e => setHora(Number(e.target.value))} className="input w-40">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{horaLabel(i)}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Horário de Brasília</p>
          </div>

          {/* Mensagem principal */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mensagem</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {['{{primeiro_nome}}','{{nome}}','{{procedimento}}','{{profissional}}','{{clinica}}'].map(v => (
                <button key={v} type="button" onClick={() => setTemplate(t => t + v)}
                  className="text-xs px-2 py-1 bg-violet-50 text-violet-700 rounded-lg border border-violet-200 hover:bg-violet-100">
                  {v}
                </button>
              ))}
            </div>
            <textarea rows={5} value={template} onChange={e => setTemplate(e.target.value)} className="input w-full font-mono text-sm" />
            <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-100 text-sm text-slate-700 whitespace-pre-wrap">
              <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1"><Icon name="eye" className="w-3 h-3" /> Preview</p>
              {preview}
            </div>
          </div>

          {/* ── Sequência adicional ──────────────────────────────── */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-slate-800">Mensagens de acompanhamento</p>
                <p className="text-sm text-slate-500">Envie mensagens adicionais X horas ou dias após o retorno concluído</p>
              </div>
              <button type="button" onClick={addSeq}
                className="flex items-center gap-1 text-sm px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg border border-violet-200 hover:bg-violet-100">
                <Icon name="plus" className="w-4 h-4" /> Adicionar mensagem
              </button>
            </div>

            {seq.length === 0 && (
              <p className="text-sm text-slate-400 italic">Nenhuma mensagem adicional configurada.</p>
            )}

            {seq.map((s, idx) => (
              <div key={idx} className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateSeq(idx, { ativo: !s.ativo })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.ativo ? 'bg-violet-600' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${s.ativo ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm font-medium text-slate-700">Mensagem {idx + 2}</span>
                  </div>
                  <button type="button" onClick={() => removeSeq(idx)} className="text-slate-400 hover:text-red-500">
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <label className="text-sm text-slate-600 whitespace-nowrap">Enviar após</label>
                  <input type="number" min={1} max={s.unidade === 'horas' ? 168 : 365} value={s.valor}
                    onChange={e => updateSeq(idx, { valor: Number(e.target.value) })}
                    className="input w-20 text-center" />
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                    <button type="button" onClick={() => updateSeq(idx, { unidade: 'horas' })}
                      className={`px-3 py-1.5 text-sm ${s.unidade === 'horas' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                      horas
                    </button>
                    <button type="button" onClick={() => updateSeq(idx, { unidade: 'dias' })}
                      className={`px-3 py-1.5 text-sm ${s.unidade === 'dias' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                      dias
                    </button>
                  </div>
                  <label className="text-sm text-slate-600">do retorno concluído</label>
                </div>
                {s.unidade === 'horas' && (
                  <p className="text-xs text-slate-400 mb-3">Enviado assim que o cron (roda a cada hora) detectar que o tempo passou — pode variar em até ~1h do horário exato.</p>
                )}

                <textarea rows={4} value={s.template}
                  onChange={e => updateSeq(idx, { template: e.target.value })}
                  className="input w-full font-mono text-sm" />
              </div>
            ))}
          </div>

          {/* Teste */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="font-semibold text-sm text-slate-900 mb-1">Enviar teste pra um número</p>
            <p className="text-xs text-slate-500 mb-2">Selecione qual mensagem testar e informe o número.</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => setTestMsgIdx(-1)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${testMsgIdx === -1 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}
              >
                Msg principal
              </button>
              {seq.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTestMsgIdx(i)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${testMsgIdx === i ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}
                >
                  +{s.valor}{s.unidade === 'horas' ? 'h' : 'd'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                placeholder="Ex: 5534999999999"
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
              <button type="button" onClick={sendTest} disabled={testing}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium whitespace-nowrap">
                {testing ? '...' : '📤 Enviar teste'}
              </button>
            </div>
            {testMsg && (
              <div className={`mt-2 p-2 rounded-lg text-xs ${testMsg.kind === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {testMsg.text}
              </div>
            )}
          </div>

          {/* Salvar */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary px-6">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            {saved && (
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <Icon name="check" className="w-4 h-4" /> Salvo!
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
