'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Initial = {
  enabled: boolean
  diasInativo: number
  template: string
}

type Props = {
  clinicId: string
  clinicName: string
  initial: Initial
}

const SUGGESTIONS = [
  {
    id: 'carinhoso',
    label: 'Carinhoso',
    text: `Oi {{primeiro_nome}}! 💕

Faz {{tempo}} que você esteve aqui na {{clinica}} — sentimos sua falta!

Que tal voltar pra cuidar de você? Lembramos que da última vez foi {{ultimo_procedimento}} — e o resultado fica ainda melhor com manutenção. ✨

Posso te enviar nossos horários disponíveis?`,
  },
  {
    id: 'manutencao',
    label: 'Foco em manutenção',
    text: `Olá {{primeiro_nome}}, tudo bem?

Já se passaram {{tempo}} desde seu último atendimento ({{ultimo_procedimento}}) aqui na {{clinica}}.

Pra manter o melhor resultado, esse é um bom momento pra voltar! 💆‍♀️

Quer ver os horários disponíveis essa semana?`,
  },
  {
    id: 'mimo',
    label: 'Com mimo',
    text: `{{primeiro_nome}}, que saudade! 🥰

Faz {{tempo}} que a gente não se vê. Pra te receber de volta, separei uma condição especial pro seu próximo {{ultimo_procedimento}}. ✨

Bora marcar?`,
  },
  {
    id: 'profissional',
    label: 'Profissional',
    text: `Olá {{nome}},

Identificamos que sua última visita à {{clinica}} foi em {{ultima_visita}}.

Recomendamos manutenção periódica para potencializar os resultados do seu {{ultimo_procedimento}}. Gostaria de agendar uma nova consulta?

Equipe {{clinica}}`,
  },
]

const PLACEHOLDERS = [
  { tag: '{{primeiro_nome}}', desc: 'Primeiro nome do paciente' },
  { tag: '{{nome}}', desc: 'Nome completo' },
  { tag: '{{tempo}}', desc: 'Tempo desde última visita (ex: "5 meses")' },
  { tag: '{{ultima_visita}}', desc: 'Data da última visita (dd/mm/aaaa)' },
  { tag: '{{ultimo_procedimento}}', desc: 'Nome do último procedimento' },
  { tag: '{{dias_inativo}}', desc: 'Número de dias desde a última visita' },
  { tag: '{{clinica}}', desc: 'Nome da sua clínica' },
]

const DAYS_PRESETS = [
  { value: 90, label: '3 meses (90 dias)' },
  { value: 120, label: '4 meses (120 dias)' },
  { value: 150, label: '5 meses (150 dias) — recomendado' },
  { value: 180, label: '6 meses (180 dias)' },
  { value: 270, label: '9 meses (270 dias)' },
  { value: 365, label: '1 ano (365 dias)' },
]

function renderPreview(
  template: string,
  vars: {
    nome: string
    primeiro_nome: string
    clinica: string
    ultimo_procedimento: string
    tempo: string
    ultima_visita: string
    dias_inativo: number
  },
) {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*ultimo_procedimento\s*\}\}/g, vars.ultimo_procedimento)
    .replace(/\{\{\s*tempo\s*\}\}/g, vars.tempo)
    .replace(/\{\{\s*ultima_visita\s*\}\}/g, vars.ultima_visita)
    .replace(/\{\{\s*dias_inativo\s*\}\}/g, String(vars.dias_inativo))
}

export default function RecallForm({ clinicId, clinicName, initial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [diasInativo, setDiasInativo] = useState(initial.diasInativo || 150)
  const [template, setTemplate] = useState(initial.template)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const previewVars = useMemo(() => {
    const tempoStr =
      diasInativo < 30
        ? `${diasInativo} dias`
        : diasInativo < 365
        ? `${Math.round(diasInativo / 30)} meses`
        : `${Math.floor(diasInativo / 365)} anos`
    return {
      nome: 'Maria Aparecida da Silva',
      primeiro_nome: 'Maria',
      clinica: clinicName,
      ultimo_procedimento: 'Limpeza de pele',
      tempo: tempoStr,
      ultima_visita: new Date(Date.now() - diasInativo * 24 * 60 * 60 * 1000).toLocaleDateString(
        'pt-BR',
      ),
      dias_inativo: diasInativo,
    }
  }, [clinicName, diasInativo])

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
            recall_inativos: enabled,
            recall_dias: diasInativo,
            template_recall: template,
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
        body: JSON.stringify({ phone: testPhone, message: text }),
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
          <p className="font-semibold text-slate-900">Ativar recall automático</p>
          <p className="text-sm text-slate-500">
            Quando ligado, todo dia às 10h o sistema procura pacientes que não voltam há mais
            tempo que você definir abaixo e manda uma mensagem chamando pra agendar. Cada
            paciente recebe no máximo 1 recall a cada 90 dias.
          </p>
        </div>
      </label>

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
        {/* Quantos dias sem voltar */}
        <div className="space-y-2 mb-6">
          <label className="block text-sm font-medium text-slate-900">
            Considerar inativo após
          </label>
          <select
            value={diasInativo}
            onChange={(e) => setDiasInativo(parseInt(e.target.value, 10))}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {DAYS_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Pacientes cuja última consulta foi antes de{' '}
            {new Date(Date.now() - diasInativo * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}{' '}
            entram na lista.
          </p>
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
            rows={9}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
            placeholder="Digite a mensagem... use {{primeiro_nome}}, {{tempo}}, {{ultimo_procedimento}} pra personalizar"
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

        {/* Preview */}
        {template.trim() && (
          <div className="space-y-2 mb-6">
            <label className="block text-sm font-medium text-slate-900">
              Pré-visualização
              <span className="ml-2 text-xs text-slate-500">
                (exemplo: paciente que sumiu há {previewVars.tempo})
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
