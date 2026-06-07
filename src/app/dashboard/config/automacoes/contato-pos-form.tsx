'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Props = {
  clinicId: string
  clinicName: string
  initial: {
    enabled: boolean
    hora: number
    template: string
    excluirCategorias: string[]
  }
}

const DEFAULT_TEMPLATE = `Oi {{primeiro_nome}}! 💜

Passando pra saber como você está após o seu atendimento de {procedimento} aqui na {clinica}.

Sentiu algum desconforto? Tem alguma dúvida? É só chamar! Estamos à disposição 🤍`

const VARIABLES = [
  { key: '{{primeiro_nome}}', desc: 'Primeiro nome' },
  { key: '{{nome}}', desc: 'Nome completo' },
  { key: '{{procedimento}}', desc: 'Procedimento realizado' },
  { key: '{{profissional}}', desc: 'Nome da profissional' },
  { key: '{{clinica}}', desc: 'Nome da clínica' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function ContatoPosForm({ clinicId, clinicName, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [hora, setHora] = useState(initial.hora)
  const [template, setTemplate] = useState(initial.template || DEFAULT_TEMPLATE)
  const [excluirCat, setExcluirCat] = useState(initial.excluirCategorias.join(', '))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const supabase = createClient()

  const preview = template
    .replace(/\{\{primeiro_nome\}\}/g, 'Ana')
    .replace(/\{\{nome\}\}/g, 'Ana Silva')
    .replace(/\{\{procedimento\}\}/g, 'Microvasos')
    .replace(/\{\{profissional\}\}/g, 'Dra. Sarah')
    .replace(/\{\{clinica\}\}/g, clinicName)

  const horaLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

  async function sendTest() {
    if (!testPhone.trim()) {
      setTestMsg({ kind: 'err', text: 'Informe um número com DDD (ex: 5534999999999)' })
      return
    }
    setTesting(true); setTestMsg(null)
    try {
      const text = template
        .replace(/\{\{primeiro_nome\}\}/g, 'Ana')
        .replace(/\{\{nome\}\}/g, 'Ana Silva')
        .replace(/\{\{procedimento\}\}/g, 'Botox')
        .replace(/\{\{profissional\}\}/g, 'Dra. Sarah')
        .replace(/\{\{clinica\}\}/g, clinicName)
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
          <p className="font-medium text-slate-900">Ativar contato pós-procedimento</p>
          <p className="text-sm text-slate-500 mt-0.5">
            Todo dia envia mensagens para os pacientes que fizeram procedimentos no dia anterior
          </p>
        </div>
        <button
          onClick={() => setEnabled(e => !e)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {enabled && (
        <>
          {/* Como funciona */}
          <div className="bg-violet-50 rounded-xl p-4 border border-violet-100 text-sm text-violet-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <Icon name="info" className="w-4 h-4" />
              Como funciona
            </p>
            <p>Todo dia às <strong>{horaLabel(hora)}</strong>, o sistema seleciona todos os pacientes que finalizaram um procedimento <strong>ontem</strong> e envia a mensagem automaticamente.</p>
            <p className="text-violet-600">Avaliações, retornos e consultas são excluídos automaticamente.</p>
          </div>

          {/* Horário de envio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Horário de envio
            </label>
            <select
              value={hora}
              onChange={e => setHora(Number(e.target.value))}
              className="input w-40"
            >
              {HOURS.map(h => (
                <option key={h} value={h}>{horaLabel(h)}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Horário de Brasília</p>
          </div>

          {/* Categorias excluídas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Categorias de procedimento a excluir
            </label>
            <input
              type="text"
              value={excluirCat}
              onChange={e => setExcluirCat(e.target.value)}
              className="input"
              placeholder="Atendimento, Cursos"
            />
            <p className="text-xs text-slate-400 mt-1">
              Separe por vírgula. Os nomes devem bater com as categorias cadastradas nos seus procedimentos.
              Avaliação, Retorno e Consulta já são excluídos automaticamente pelo nome.
            </p>
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {VARIABLES.map(v => (
                <button
                  key={v.key}
                  type="button"
                  title={v.desc}
                  onClick={() => setTemplate(t => t + v.key)}
                  className="px-2 py-0.5 bg-violet-50 text-violet-700 text-xs font-mono rounded hover:bg-violet-100 transition-colors"
                >
                  {v.key}
                </button>
              ))}
            </div>
            <textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={6}
              className="input font-mono text-sm"
            />
          </div>

          {/* Preview */}
          <div className="bg-[#e7ffd1] rounded-xl p-4 border border-green-200 max-w-sm">
            <p className="text-[10px] font-semibold text-green-700 mb-2 flex items-center gap-1">
              <Icon name="eye" className="w-3 h-3" />
              Preview
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
          </div>
        </>
      )}

      {/* Teste */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
        <p className="font-semibold text-sm text-slate-900 mb-1">Enviar teste pra um número</p>
        <p className="text-xs text-slate-500 mb-3">Recomendamos testar antes de ativar.</p>
        <div className="flex gap-2">
          <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)}
            placeholder="Ex: 5534999999999"
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
          <button type="button" onClick={sendTest} disabled={testing}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium">
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
    </div>
  )
}


