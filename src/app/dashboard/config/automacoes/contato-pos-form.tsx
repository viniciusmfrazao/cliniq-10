'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

const DEFAULT_TEMPLATE = `Oi {{primeiro_nome}}! 💜

Passando pra saber como você está se sentindo após o seu atendimento de {{procedimento}} aqui na {{clinica}}.

Qualquer dúvida ou desconforto, estou à disposição! 🤍`

const DEFAULT_SEQ_TEMPLATES = [
  `Oi {{primeiro_nome}}! 😊

Passaram alguns dias desde seu {{procedimento}} — o resultado já deve estar aparecendo! Está gostando?

Qualquer dúvida é só chamar. 💜`,
  `Oi {{primeiro_nome}}! 🌟

Já faz um tempo desde o seu {{procedimento}} na {{clinica}}. Que tal agendar a próxima sessão?

Estamos sempre aqui pra te receber! 💜`,
]

interface SeqItem {
  dias: number
  ativo: boolean
  template: string
}

interface Initial {
  enabled: boolean
  hora: number
  template: string | null
  excluirCategorias: string[]
  seq: SeqItem[]
}

interface Props {
  clinicId: string
  clinicName: string
  initial: Initial
}

export default function ContatoPosForm({ clinicId, clinicName, initial }: Props) {
  const supabase = createClient()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [hora, setHora] = useState(initial.hora)
  const [template, setTemplate] = useState(initial.template || DEFAULT_TEMPLATE)
  const [excluirCat, setExcluirCat] = useState(initial.excluirCategorias.join(', '))
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
    .replace(/\{\{procedimento\}\}/g, 'Microvasos')
    .replace(/\{\{profissional\}\}/g, 'Dra. Ana')
    .replace(/\{\{clinica\}\}/g, clinicName)

  function addSeq() {
    const nextDias = seq.length === 0 ? 7 : (seq[seq.length - 1].dias + 7)
    setSeq([...seq, {
      dias: nextDias,
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
      .replace(/\{\{procedimento\}\}/g, 'Botox')
      .replace(/\{\{profissional\}\}/g, 'Dra. Ana')
      .replace(/\{\{clinica\}\}/g, clinicName)
  }

  async function sendTest() {
    if (!testPhone.trim()) {
      setTestMsg({ kind: 'err', text: 'Informe um número com DDD (ex: 5534999999999)' })
      return
    }
    // testMsgIdx = -1 → mensagem principal; >= 0 → item da sequência
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
    const cats = excluirCat.split(',').map(s => s.trim()).filter(Boolean)
    await supabase.from('clinic_automations').upsert({
      clinic_id: clinicId,
      contato_pos_procedimento: enabled,
      contato_pos_hora: hora,
      template_contato_pos: template,
      contato_pos_excluir_categorias: cats,
      contato_pos_seq: seq,
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
          <p className="font-semibold text-slate-800">Ativar contato pós-procedimento</p>
          <p className="text-sm text-slate-500">Todo dia envia mensagens para os pacientes que fizeram procedimentos no dia anterior</p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(p => !p)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {enabled && (
        <>
          {/* Como funciona */}
          <div className="p-4 bg-violet-50 rounded-xl text-sm text-violet-700 border border-violet-100">
            <p className="font-semibold mb-1 flex items-center gap-1"><Icon name="info" className="w-4 h-4" /> Como funciona</p>
            <p>Todo dia às <strong>{horaLabel(hora)}</strong>, o sistema seleciona todos os pacientes que finalizaram um procedimento <strong>ontem</strong> e envia a mensagem automaticamente.</p>
            <p className="text-violet-500 mt-1">Avaliações, retornos e consultas são excluídos automaticamente.</p>
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

          {/* Categorias excluir */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categorias de procedimento a excluir</label>
            <input type="text" value={excluirCat} onChange={e => setExcluirCat(e.target.value)}
              className="input w-full" placeholder="Ex: Avaliação, Consulta, Retorno" />
            <p className="text-xs text-slate-400 mt-1">Separe por vírgula. Avaliação, Retorno e Consulta já são excluídos automaticamente pelo nome.</p>
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
                <p className="text-sm text-slate-500">Envie mensagens adicionais X dias após o procedimento</p>
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

                <div className="flex items-center gap-2 mb-3">
                  <label className="text-sm text-slate-600 whitespace-nowrap">Enviar após</label>
                  <input type="number" min={1} max={365} value={s.dias}
                    onChange={e => updateSeq(idx, { dias: Number(e.target.value) })}
                    className="input w-20 text-center" />
                  <label className="text-sm text-slate-600">dias do procedimento</label>
                </div>

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
            {/* Seletor compacto de qual mensagem testar */}
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
                  +{s.dias}d
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
