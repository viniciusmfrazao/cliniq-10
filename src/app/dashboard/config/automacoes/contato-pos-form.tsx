'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'

type Props = {
  clinicId: string
  clinicName: string
  initial: {
    enabled: boolean
    delayHoras: number
    template: string
  }
}

const DEFAULT_TEMPLATE = `Oi {primeiro_nome}! 💜

Passando pra saber como você está após o seu atendimento de {procedimento} aqui na {clinica}.

Sentiu algum desconforto? Tem alguma dúvida? É só chamar! Estamos à disposição 🤍`

const VARIABLES = [
  { key: '{primeiro_nome}', desc: 'Primeiro nome do paciente' },
  { key: '{nome}', desc: 'Nome completo' },
  { key: '{procedimento}', desc: 'Procedimento realizado' },
  { key: '{profissional}', desc: 'Nome da profissional' },
  { key: '{clinica}', desc: 'Nome da clínica' },
]

export default function ContatoPosForm({ clinicId, clinicName, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [delayHoras, setDelayHoras] = useState(initial.delayHoras)
  const [template, setTemplate] = useState(initial.template || DEFAULT_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const preview = template
    .replace(/\{primeiro_nome\}/g, 'Ana')
    .replace(/\{nome\}/g, 'Ana Silva')
    .replace(/\{procedimento\}/g, 'Microvasos')
    .replace(/\{profissional\}/g, 'Dra. Sarah')
    .replace(/\{clinica\}/g, clinicName)

  async function handleSave() {
    setSaving(true)
    await supabase.from('clinic_automations').upsert({
      clinic_id: clinicId,
      contato_pos_procedimento: enabled,
      contato_pos_delay_horas: delayHoras,
      template_contato_pos: template,
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
            Envia uma mensagem automática algumas horas após o atendimento ser finalizado
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
          {/* Delay */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Enviar após quantas horas?
            </label>
            <select
              value={delayHoras}
              onChange={e => setDelayHoras(Number(e.target.value))}
              className="input w-48"
            >
              <option value={1}>1 hora</option>
              <option value={2}>2 horas</option>
              <option value={3}>3 horas</option>
              <option value={4}>4 horas</option>
              <option value={6}>6 horas</option>
              <option value={12}>12 horas</option>
              <option value={24}>24 horas (dia seguinte)</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Contado a partir do momento em que o atendimento é marcado como finalizado
            </p>
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mensagem
            </label>
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
              placeholder={DEFAULT_TEMPLATE}
            />
          </div>

          {/* Preview */}
          <div className="bg-[#e7ffd1] rounded-xl p-4 border border-green-200 max-w-sm">
            <p className="text-[10px] font-semibold text-green-700 mb-2 flex items-center gap-1">
              <Icon name="eye" className="w-3 h-3" />
              Preview — como vai aparecer no WhatsApp
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
          </div>
        </>
      )}

      {/* Salvar */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-6"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <Icon name="check" className="w-4 h-4" />
            Salvo!
          </span>
        )}
      </div>
    </div>
  )
}
