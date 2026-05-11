'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Initial = {
  enabled: boolean
  template: string
  imediato: boolean
  delayMinutes: number
}

const DELAY_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
]

type Props = {
  clinicId: string
  clinicName: string
  initial: Initial
}

const SUGGESTIONS = [
  {
    id: 'simples',
    label: 'Simples (1-5)',
    text: `Oi {{primeiro_nome}}! 💕

Aqui é da {{clinica}}. Como foi seu atendimento ontem com {{profissional}}?

Responde de 1 a 5:
1️⃣ Péssimo
2️⃣ Ruim
3️⃣ Regular
4️⃣ Bom
5️⃣ Excelente

Sua opinião é super importante pra gente! 🙏`,
  },
  {
    id: 'estrelas',
    label: 'Estrelas',
    text: `Oi {{primeiro_nome}}! ⭐

E aí, gostou do seu {{procedimento}} ontem com {{profissional}}? Responde com a quantidade de estrelas (de 1 a 5):

⭐ — não gostei
⭐⭐ — não muito
⭐⭐⭐ — ok
⭐⭐⭐⭐ — gostei
⭐⭐⭐⭐⭐ — adorei!

Equipe {{clinica}} 💕`,
  },
  {
    id: 'curto',
    label: 'Curto e direto',
    text: `Oi {{primeiro_nome}}! Tudo bem?

Numa nota de 1 a 5, como foi sua experiência ontem na {{clinica}}? 

(1 = péssimo · 5 = excelente)

Pode responder só com o número 😊`,
  },
  {
    id: 'profissional',
    label: 'Profissional',
    text: `Olá {{nome}},

A {{clinica}} agradece pela sua presença ontem. Para continuarmos melhorando, gostaríamos da sua avaliação:

Numa escala de 1 a 5, como foi seu {{procedimento}} com {{profissional}}?
1 — Péssimo · 2 — Ruim · 3 — Regular · 4 — Bom · 5 — Excelente

Caso queira deixar um comentário, pode escrever em seguida.`,
  },
]

const PLACEHOLDERS = [
  { tag: '{{primeiro_nome}}', desc: 'Primeiro nome do paciente' },
  { tag: '{{nome}}', desc: 'Nome completo' },
  { tag: '{{procedimento}}', desc: 'Procedimento realizado' },
  { tag: '{{profissional}}', desc: 'Nome do profissional' },
  { tag: '{{data}}', desc: 'Data do atendimento (dd/mm/aaaa)' },
  { tag: '{{hora}}', desc: 'Hora do atendimento (hh:mm)' },
  { tag: '{{dia_semana}}', desc: 'Dia da semana' },
  { tag: '{{clinica}}', desc: 'Nome da sua clínica' },
]

function renderPreview(
  template: string,
  vars: {
    nome: string
    primeiro_nome: string
    clinica: string
    profissional: string
    procedimento: string
    data: string
    hora: string
    dia_semana: string
  },
) {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*profissional\s*\}\}/g, vars.profissional)
    .replace(/\{\{\s*procedimento\s*\}\}/g, vars.procedimento)
    .replace(/\{\{\s*data\s*\}\}/g, vars.data)
    .replace(/\{\{\s*hora\s*\}\}/g, vars.hora)
    .replace(/\{\{\s*dia_semana\s*\}\}/g, vars.dia_semana)
}

export default function NpsForm({ clinicId, clinicName, initial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [template, setTemplate] = useState(initial.template)
  const [imediato, setImediato] = useState(initial.imediato)
  const [delayMinutes, setDelayMinutes] = useState(initial.delayMinutes)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  // Preview com atendimento de "ontem"
  const previewVars = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return {
      nome: 'Maria Aparecida da Silva',
      primeiro_nome: 'Maria',
      clinica: clinicName,
      profissional: 'Dra. Sarah',
      procedimento: 'Limpeza de pele',
      data: yesterday.toLocaleDateString('pt-BR'),
      hora: '14:30',
      dia_semana: yesterday.toLocaleDateString('pt-BR', { weekday: 'long' }),
    }
  }, [clinicName])

  const preview = useMemo(() => renderPreview(template, previewVars), [template, previewVars])

  async function save() {
    setSaving(true)
    setSavedAt(null)
    try {
      const { error } = await supabase
        .from('clinic_automations')
        .upsert(
          {
            clinic_id: clinicId,
            nps_pos_atendimento: enabled,
            template_nps: template,
            nps_imediato: imediato,
            nps_delay_minutes: delayMinutes,
          },
          { onConflict: 'clinic_id' },
        )
      if (error) {
        alert(`Erro ao salvar: ${error.message}`)
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
    setTesting(true)
    setTestMsg(null)
    try {
      const text = renderPreview(template, {
        ...previewVars,
        nome: 'Você (teste)',
        primeiro_nome: 'Você',
      })
      const r = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: text, purpose: 'automation' }),
      })
      const data = await r.json()
      if (r.ok && data.ok) {
        setTestMsg({ kind: 'ok', text: 'Mensagem de teste enviada com sucesso!' })
      } else {
        setTestMsg({ kind: 'err', text: data.error || `Falha (HTTP ${r.status})` })
      }
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
          <p className="font-semibold text-slate-900">Ativar pesquisa NPS automática</p>
          <p className="text-sm text-slate-500">
            Quando ligado, o sistema pergunta de 1 a 5 pra cada paciente que teve atendimento
            concluído. A nota é capturada automaticamente quando o paciente responde só um número.
            Você escolhe se o envio é logo após o atendimento ou no dia seguinte às 11h.
          </p>
        </div>
      </label>

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
        {/* Modo de envio: imediato ou cron diário */}
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-medium text-slate-900">Quando enviar?</label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setImediato(false)}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${
                !imediato
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    !imediato ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                  }`}
                >
                  {!imediato && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <p className="font-semibold text-sm text-slate-900">No dia seguinte às 11h</p>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                Cron diário às 11h da manhã. Bom pra deixar o paciente "esfriar" e responder com calma.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setImediato(true)}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${
                imediato
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    imediato ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                  }`}
                >
                  {imediato && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <p className="font-semibold text-sm text-slate-900">Logo após o atendimento</p>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                Dispara minutos depois do atendimento ser marcado como "Realizado". Avaliação mais quente.
              </p>
            </button>
          </div>

          {imediato && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <label className="block text-xs font-medium text-blue-900 mb-2">
                Esperar quanto tempo após finalizar?
              </label>
              <div className="flex flex-wrap gap-2">
                {DELAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDelayMinutes(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      delayMinutes === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Recomendado: <strong>30 minutos</strong> — dá tempo do paciente sair da clínica
                e ainda assim recebe enquanto a experiência está fresca.
              </p>
            </div>
          )}
        </div>

        {/* Sugestões */}
        <div className="space-y-2 mb-3">
          <label className="block text-sm font-medium text-slate-900">
            Sugestões de texto
            <span className="ml-2 text-xs text-slate-500">
              (clique pra usar como ponto de partida)
            </span>
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

        {/* Editor */}
        <div className="space-y-2 mb-2">
          <label className="block text-sm font-medium text-slate-900">Texto da mensagem</label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
            placeholder="Digite a mensagem... use {{primeiro_nome}}, {{procedimento}}, {{profissional}} pra personalizar"
          />
        </div>

        {/* Placeholders */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.tag}
              type="button"
              onClick={() => setTemplate((t) => t + ' ' + p.tag)}
              className="px-2.5 py-1 text-xs font-mono bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md border border-emerald-200"
              title={p.desc}
            >
              {p.tag}
            </button>
          ))}
        </div>

        {/* Aviso captura automática */}
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6">
          <p className="text-sm text-blue-900 font-medium mb-1 flex items-center gap-2">
            <Icon name="info" className="w-4 h-4" />
            Captura automática da resposta
          </p>
          <p className="text-xs text-blue-700">
            Quando o paciente responder com um único dígito de <strong>1 a 5</strong> nas 48h
            seguintes, o sistema vincula a nota automaticamente ao atendimento. Comentários
            adicionais que ele mandar logo depois também são salvos.
          </p>
        </div>

        {/* Preview */}
        {template.trim() && (
          <div className="space-y-2 mb-6">
            <label className="block text-sm font-medium text-slate-900">
              Pré-visualização
              <span className="ml-2 text-xs text-slate-500">
                (exemplo: paciente atendida ontem)
              </span>
            </label>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
            </div>
          </div>
        )}

        {/* Teste */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="font-semibold text-sm text-slate-900 mb-2">Enviar teste pra um número</p>
          <p className="text-xs text-slate-500 mb-3">
            Recomendamos testar pro seu próprio celular antes de ativar.
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
              disabled={testing || !template.trim()}
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
