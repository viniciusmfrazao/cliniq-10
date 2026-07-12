'use client'

import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { parseSupabaseError } from '@/lib/error-messages'
import AudioModeField, { EnvioMode } from '@/components/ui/AudioModeField'


type Initial = {
  enabled: boolean
  hour: number
  optinRequired: boolean
  template: string
  modo: EnvioMode
  audioUrl: string | null
}

type Props = {
  clinicId: string
  clinicName: string
  initial: Initial
}

const SUGGESTIONS = [
  {
    id: 'amigavel',
    label: 'Amigável e calorosa',
    text: `Oi {{primeiro_nome}}! 🎉

Hoje é o seu dia e a equipe da {{clinica}} faz questão de celebrar com você!

Desejamos um ano cheio de saúde, beleza e momentos especiais. ✨

Que tal comemorar com a gente? Te enviamos um mimo de aniversário — fala com a gente pra saber mais!`,
  },
  {
    id: 'elegante',
    label: 'Elegante',
    text: `Querida(o) {{primeiro_nome}}, hoje é seu dia! 💎

A equipe da {{clinica}} se junta a você para celebrar mais um ano de vida.

Que esse novo ciclo seja repleto de saúde, brilho e momentos inesquecíveis. ✨

Conte sempre conosco.`,
  },
  {
    id: 'curto',
    label: 'Curto e direto',
    text: `Feliz aniversário, {{primeiro_nome}}! 🎂

Toda equipe da {{clinica}} torce por você hoje e sempre.

Tem um carinho especial pra você no nosso espaço. Vem comemorar! 💕`,
  },
  {
    id: 'sem_emoji',
    label: 'Profissional sem emoji',
    text: `Olá {{primeiro_nome}}!

Hoje é um dia muito especial e a equipe da {{clinica}} faz questão de celebrar com você. Desejamos um ótimo dia e um ano cheio de conquistas, saúde e bem-estar.

Estamos aqui sempre que precisar.`,
  },
]

const PLACEHOLDERS = [
  { tag: '{{primeiro_nome}}', desc: 'Primeiro nome do paciente' },
  { tag: '{{nome}}', desc: 'Nome completo' },
  { tag: '{{clinica}}', desc: 'Nome da sua clínica' },
  { tag: '{{idade}}', desc: 'Idade que está completando' },
]

function renderPreview(
  template: string,
  vars: { nome: string; primeiro_nome: string; clinica: string; idade: string },
) {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*idade\s*\}\}/g, vars.idade)
}

export default function BirthdayAutomationForm({ clinicId, clinicName, initial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [hour, setHour] = useState(initial.hour ?? 9)
  const [optinRequired, setOptinRequired] = useState(initial.optinRequired)
  const [template, setTemplate] = useState(initial.template)
  const [modo, setModo] = useState<EnvioMode>(initial.modo)
  const [audioUrl, setAudioUrl] = useState<string | null>(initial.audioUrl)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const templateRef = useRef<HTMLTextAreaElement>(null)

  const preview = useMemo(
    () =>
      renderPreview(template, {
        nome: 'Maria Aparecida da Silva',
        primeiro_nome: 'Maria',
        clinica: clinicName,
        idade: '32',
      }),
    [template, clinicName],
  )

  async function save() {
    setSaving(true)
    setSavedAt(null)
    try {
      const { error } = await supabase
        .from('clinic_automations')
        .update({
          aniversario: enabled,
          template_aniversario: template,
          aniversario_optin_required: optinRequired,
          aniversario_hora: hour,
          modo_aniversario: modo,
          audio_aniversario: audioUrl,
        })
        .eq('clinic_id', clinicId)

      if (error) {
        alert(parseSupabaseError(error))
        return
      }
      setSavedAt(new Date())
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    if (!testPhone.trim()) {
      setTestMsg({ kind: 'err', text: 'Informe um telefone para teste (com DDD)' })
      return
    }
    if (modo === 'audio' && !audioUrl) {
      setTestMsg({ kind: 'err', text: 'Grave um áudio antes de testar.' })
      return
    }
    setTesting(true)
    setTestMsg(null)
    try {
      if (modo === 'audio' || modo === 'ambos') {
        const rAudio = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, type: 'audio', media: audioUrl, purpose: 'automation' }),
        })
        const dAudio = await rAudio.json()
        if (!(rAudio.ok && dAudio.ok)) {
          setTestMsg({ kind: 'err', text: dAudio.error || 'Erro ao enviar áudio' })
          return
        }
      }
      if (modo === 'texto' || modo === 'ambos') {
        const text = renderPreview(template, {
          nome: 'Você (teste)',
          primeiro_nome: 'Você',
          clinica: clinicName,
          idade: '∞',
        })
        const r = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, message: text, purpose: 'automation' }),
        })
        const data = await r.json()
        if (!(r.ok && data.ok)) {
          setTestMsg({ kind: 'err', text: data.error || `Falha (HTTP ${r.status})` })
          return
        }
      }
      setTestMsg({ kind: 'ok', text: 'Mensagem de teste enviada com sucesso!' })
    } catch (e) {
      setTestMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Erro de rede' })
    } finally {
      setTesting(false)
    }
  }

  function applySuggestion(text: string) {
    if (template.trim() && !confirm('Substituir o texto atual pela sugestão?')) return
    setTemplate(text)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toggle principal */}
      <label className="flex items-start gap-4 cursor-pointer">
        <div className="relative inline-flex items-center mt-1">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Ativar envio automático</p>
          <p className="text-sm text-slate-500">
            Quando ligado, o sistema envia uma mensagem de aniversário no dia do paciente, no
            horário escolhido.
          </p>
        </div>
      </label>

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
        {/* Horário editável */}
        <div className="space-y-2 mb-6">
          <label className="block text-sm font-medium text-slate-900">
            Horário do envio
            <span className="ml-2 text-xs text-slate-500">(fuso de Brasília)</span>
          </label>
          <div className="flex items-center gap-3">
            <select
              value={hour}
              onChange={e => setHour(Number(e.target.value))}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
            >
              {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              O sistema enviará a mensagem neste horário no dia do aniversário.
            </p>
          </div>
        </div>

        {/* Opt-in */}
        <label className="flex items-start gap-4 cursor-pointer mb-6">
          <div className="relative inline-flex items-center mt-1">
            <input
              type="checkbox"
              checked={optinRequired}
              onChange={(e) => setOptinRequired(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-blue-500 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Exigir consentimento (LGPD)</p>
            <p className="text-sm text-slate-500">
              Quando ligado, só envia para pacientes que marcaram <strong>opt-in de WhatsApp</strong>{' '}
              na ficha. Mais seguro juridicamente. Quando desligado, envia para todos os
              pacientes com telefone cadastrado.
            </p>
          </div>
        </label>

        {/* Sugestões */}
        <div className="space-y-2 mb-3">
          <label className="block text-sm font-medium text-slate-900">
            Sugestões de texto
            <span className="ml-2 text-xs text-slate-500">(clique pra usar como ponto de partida)</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applySuggestion(s.text)}
                className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modo de envio + áudio */}
        <AudioModeField
          clinicId={clinicId}
          automationKey="aniversario"
          mode={modo}
          onModeChange={setModo}
          audioUrl={audioUrl}
          onAudioChange={setAudioUrl}
        />

        {/* Editor */}
        {(modo === 'texto' || modo === 'ambos') && (
        <div className="space-y-2 mb-2">
          <label className="block text-sm font-medium text-slate-900">Texto da mensagem</label>
          <textarea
            ref={templateRef}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
            placeholder="Digite a mensagem... use {{primeiro_nome}}, {{clinica}}, {{idade}} pra personalizar"
          />
        </div>
        )}

        {/* Placeholders */}
        {(modo === 'texto' || modo === 'ambos') && (
        <div className="flex flex-wrap gap-2 mb-6">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.tag}
              type="button"
              onClick={() => {
                const el = templateRef.current
                if (!el) { setTemplate((t) => t + ' ' + p.tag); return }
                const start = el.selectionStart ?? template.length
                const end = el.selectionEnd ?? template.length
                const next = template.slice(0, start) + p.tag + template.slice(end)
                setTemplate(next)
                requestAnimationFrame(() => {
                  el.focus()
                  const pos = start + p.tag.length
                  el.setSelectionRange(pos, pos)
                })
              }}
              className="px-2.5 py-1 text-xs font-mono bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md border border-emerald-200"
              title={p.desc}
            >
              {p.tag}
            </button>
          ))}
        </div>
        )}

        {/* Preview */}
        {template.trim() && (modo === 'texto' || modo === 'ambos') && (
          <div className="space-y-2 mb-6">
            <label className="block text-sm font-medium text-slate-900">
              Pré-visualização
              <span className="ml-2 text-xs text-slate-500">(como o paciente vai receber)</span>
            </label>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
            </div>
          </div>
        )}

        {/* Teste */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="font-semibold text-sm text-slate-900 mb-2">
            Enviar teste pra um número
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Recomendamos testar pro seu próprio celular antes de ativar pra todo mundo.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Ex: 5534999999999"
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              onClick={sendTest}
              disabled={testing || (modo !== 'audio' && !template.trim())}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              {testing ? (
                <Icon name="loader" className="w-4 h-4 animate-spin" />
              ) : (
                <Icon name="send" className="w-4 h-4" />
              )}
              Enviar teste
            </button>
          </div>
          {testMsg && (
            <div
              className={`mt-3 p-2 rounded-lg text-xs ${
                testMsg.kind === 'ok'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {testMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Salvar */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold flex items-center gap-2"
        >
          {saving ? (
            <Icon name="loader" className="w-4 h-4 animate-spin" />
          ) : (
            <Icon name="check" className="w-4 h-4" />
          )}
          Salvar configurações
        </button>
        {savedAt && (
          <span className="text-sm text-emerald-600 inline-flex items-center gap-1">
            <Icon name="check" className="w-4 h-4" />
            Salvo às{' '}
            {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}
