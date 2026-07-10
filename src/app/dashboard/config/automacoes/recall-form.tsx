'use client'

import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { parseSupabaseError } from '@/lib/error-messages'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RecallStep {
  dias: number
  ativo: boolean
  template: string
  label?: string
}

interface Initial {
  enabled: boolean
  // legado (recall_dias + template_recall) — mantido pra não quebrar quem já tinha
  diasInativo: number
  template: string
  // novo multi-etapa
  seq: RecallStep[]
}

interface Props {
  clinicId: string
  clinicName: string
  initial: Initial
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLACEHOLDERS = [
  { tag: '{{primeiro_nome}}', desc: 'Primeiro nome do paciente' },
  { tag: '{{nome}}', desc: 'Nome completo' },
  { tag: '{{tempo}}', desc: 'Tempo desde última visita (ex: "5 meses")' },
  { tag: '{{ultima_visita}}', desc: 'Data da última visita (dd/mm/aaaa)' },
  { tag: '{{ultimo_procedimento}}', desc: 'Nome do último procedimento' },
  { tag: '{{dias_inativo}}', desc: 'Número de dias desde a última visita' },
  { tag: '{{clinica}}', desc: 'Nome da sua clínica' },
]

// Presets de dias para cada etapa
const DIAS_PRESETS = [
  { value: 30, label: '30 dias' },
  { value: 45, label: '45 dias' },
  { value: 60, label: '2 meses (60 dias)' },
  { value: 90, label: '3 meses (90 dias)' },
  { value: 120, label: '4 meses (120 dias)' },
  { value: 150, label: '5 meses (150 dias)' },
  { value: 180, label: '6 meses (180 dias)' },
  { value: 270, label: '9 meses (270 dias)' },
  { value: 365, label: '1 ano (365 dias)' },
]

// Templates sugeridos por etapa
const TEMPLATES_SUGERIDOS: Record<number, string[]> = {
  1: [
    `Oi {{primeiro_nome}}! 💕\n\nFaz {{tempo}} que você esteve aqui na {{clinica}} — sentimos sua falta!\n\nQue tal voltar pra cuidar de você? Lembramos que da última vez foi {{ultimo_procedimento}} — e o resultado fica ainda melhor com manutenção. ✨\n\nPosso te enviar nossos horários disponíveis?`,
    `Olá {{primeiro_nome}}, tudo bem?\n\nJá se passaram {{tempo}} desde seu último atendimento ({{ultimo_procedimento}}) aqui na {{clinica}}.\n\nPra manter o melhor resultado, esse é um bom momento pra voltar! 💆‍♀️\n\nQuer ver os horários disponíveis essa semana?`,
  ],
  2: [
    `{{primeiro_nome}}, que saudade! 🥰\n\nFaz {{tempo}} que a gente não se vê. Pra te receber de volta, separei uma condição especial pro seu próximo {{ultimo_procedimento}}. ✨\n\nBora marcar?`,
    `Oi {{primeiro_nome}}! 💜\n\nPassaram {{tempo}} desde o seu último {{ultimo_procedimento}} aqui na {{clinica}}. Seu resultado merece manutenção!\n\nAinda tem horários disponíveis essa semana. Vou guardar um pra você? 😊`,
  ],
  3: [
    `Olá {{nome}},\n\nIdentificamos que sua última visita à {{clinica}} foi em {{ultima_visita}}.\n\nRecomendamos manutenção periódica para potencializar os resultados do seu {{ultimo_procedimento}}. Gostaria de agendar uma nova consulta?\n\nEquipe {{clinica}}`,
    `{{primeiro_nome}}, faz muito tempo! 🌟\n\nFaz {{tempo}} que você não nos visita. Sabemos que a rotina atribulada complica, mas estamos sempre aqui quando precisar. 💜\n\nQuer marcar um horário?`,
  ],
}

// Etapas padrão sugeridas ao criar do zero
const DEFAULT_SEQ: RecallStep[] = [
  {
    dias: 90,
    ativo: true,
    label: '1ª mensagem',
    template: TEMPLATES_SUGERIDOS[1][0],
  },
  {
    dias: 120,
    ativo: true,
    label: '2ª mensagem',
    template: TEMPLATES_SUGERIDOS[2][0],
  },
  {
    dias: 180,
    ativo: false,
    label: '3ª mensagem',
    template: TEMPLATES_SUGERIDOS[3][0],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanizeDias(dias: number): string {
  if (dias < 30) return `${dias} dias`
  const months = Math.round(dias / 30)
  if (months < 12) return months === 1 ? '1 mês' : `${months} meses`
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (rest === 0) return years === 1 ? '1 ano' : `${years} anos`
  return `${years}a ${rest}m`
}

function renderPreview(template: string, dias: number, clinicName: string): string {
  const tempo = humanizeDias(dias)
  const lastVisit = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, 'Maria Aparecida da Silva')
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, 'Maria')
    .replace(/\{\{\s*clinica\s*\}\}/g, clinicName)
    .replace(/\{\{\s*ultimo_procedimento\s*\}\}/g, 'Limpeza de pele')
    .replace(/\{\{\s*tempo\s*\}\}/g, tempo)
    .replace(
      /\{\{\s*ultima_visita\s*\}\}/g,
      lastVisit.toLocaleDateString('pt-BR'),
    )
    .replace(/\{\{\s*dias_inativo\s*\}\}/g, String(dias))
}

// ─── Componente de uma etapa ──────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  clinicName,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: RecallStep
  index: number
  total: number
  clinicName: string
  onChange: (patch: Partial<RecallStep>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [showPreview, setShowPreview] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const templateRef = useRef<HTMLTextAreaElement>(null)

  const preview = useMemo(
    () => renderPreview(step.template, step.dias, clinicName),
    [step.template, step.dias, clinicName],
  )

  const suggestionsForStep = TEMPLATES_SUGERIDOS[Math.min(index + 1, 3)] ?? []

  function insertPlaceholder(tag: string) {
    const el = templateRef.current
    if (!el) { onChange({ template: step.template + tag }); return }
    const start = el.selectionStart ?? step.template.length
    const end = el.selectionEnd ?? step.template.length
    const next = step.template.slice(0, start) + tag + step.template.slice(end)
    onChange({ template: next })
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + tag.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div
      className={`rounded-xl border transition-all ${
        step.ativo
          ? 'border-violet-200 bg-violet-50/30'
          : 'border-slate-200 bg-slate-50/50 opacity-70'
      }`}
    >
      {/* Header da etapa */}
      <div className="flex items-center gap-3 p-4 border-b border-inherit">
        {/* Ordem */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-20"
            title="Subir"
          >
            <Icon name="chevronUp" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-20"
            title="Descer"
          >
            <Icon name="chevronDown" className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Número */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            step.ativo
              ? 'bg-violet-600 text-white'
              : 'bg-slate-200 text-slate-500'
          }`}
        >
          {index + 1}
        </div>

        {/* Label editável */}
        <input
          type="text"
          value={step.label || `Mensagem ${index + 1}`}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 min-w-0"
          placeholder={`Mensagem ${index + 1}`}
        />

        {/* Toggle ativo */}
        <button
          type="button"
          onClick={() => onChange({ ativo: !step.ativo })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
            step.ativo ? 'bg-violet-600' : 'bg-slate-300'
          }`}
          title={step.ativo ? 'Desativar esta etapa' : 'Ativar esta etapa'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              step.ativo ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>

        {/* Remover */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
          title="Remover etapa"
        >
          <Icon name="trash" className="w-4 h-4" />
        </button>
      </div>

      {/* Corpo da etapa */}
      <div className="p-4 space-y-3">
        {/* Dias */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 whitespace-nowrap font-medium">
            Disparar quando paciente estiver inativo há
          </label>
          <select
            value={step.dias}
            onChange={(e) => onChange({ dias: Number(e.target.value) })}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            {DIAS_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Aviso se etapa anterior tem mais dias */}
        {index > 0 && (
          <p className="text-xs text-slate-500">
            Esta mensagem só será enviada se a etapa anterior já foi enviada e o paciente
            ainda não voltou.
          </p>
        )}

        {/* Sugestões */}
        {suggestionsForStep.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSuggestions((v) => !v)}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
            >
              <Icon name="sparkles" className="w-3.5 h-3.5" />
              {showSuggestions ? 'Ocultar sugestões' : 'Ver sugestões de texto'}
            </button>
            {showSuggestions && (
              <div className="mt-2 grid grid-cols-1 gap-2">
                {suggestionsForStep.map((s, si) => (
                  <button
                    key={si}
                    type="button"
                    onClick={() => {
                      if (
                        !step.template.trim() ||
                        confirm('Substituir o texto atual pela sugestão?')
                      ) {
                        onChange({ template: s })
                        setShowSuggestions(false)
                      }
                    }}
                    className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-violet-300 hover:bg-violet-50 transition-colors text-xs text-slate-700 line-clamp-3"
                  >
                    {s.split('\n')[0]}…
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Placeholders */}
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.tag}
              type="button"
              onClick={() => insertPlaceholder(p.tag)}
              className="px-2 py-0.5 text-[11px] font-mono bg-violet-50 hover:bg-violet-100 text-violet-700 rounded border border-violet-200"
              title={p.desc}
            >
              {p.tag}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={templateRef}
          value={step.template}
          onChange={(e) => onChange({ template: e.target.value })}
          rows={6}
          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-mono resize-none"
          placeholder="Digite a mensagem desta etapa..."
        />

        {/* Preview toggle */}
        {step.template.trim() && (
          <div>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <Icon name="eye" className="w-3.5 h-3.5" />
              {showPreview ? 'Ocultar preview' : 'Ver preview'}
            </button>
            {showPreview && (
              <div className="mt-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-xs font-semibold text-emerald-700 mb-1">
                  Exemplo · paciente inativo há {humanizeDias(step.dias)}
                </p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Form principal ────────────────────────────────────────────────────────────

export default function RecallForm({ clinicId, clinicName, initial }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [enabled, setEnabled] = useState(initial.enabled)
  // Inicializa seq: se já tem dados no novo formato, usa; caso contrário,
  // verifica se havia configuração legada e converte para o primeiro step.
  const [seq, setSeq] = useState<RecallStep[]>(() => {
    if (initial.seq && initial.seq.length > 0) return initial.seq
    // Migração automática de legado: se tinha diasInativo + template, cria step 1
    if (initial.template && initial.template.trim()) {
      return [
        {
          dias: initial.diasInativo || 150,
          ativo: true,
          label: '1ª mensagem',
          template: initial.template,
        },
      ]
    }
    return DEFAULT_SEQ
  })

  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testStepIdx, setTestStepIdx] = useState(0)

  // ── Manipulação da sequência ──
  function addStep() {
    const lastDias = seq.length > 0 ? seq[seq.length - 1].dias : 90
    const nextDias = Math.min(lastDias + 30, 365)
    const stepNum = seq.length + 1
    setSeq([
      ...seq,
      {
        dias: nextDias,
        ativo: true,
        label: `${stepNum}ª mensagem`,
        template: (TEMPLATES_SUGERIDOS[Math.min(stepNum, 3)] ?? TEMPLATES_SUGERIDOS[3])[0],
      },
    ])
  }

  function removeStep(idx: number) {
    if (!confirm(`Remover a etapa "${seq[idx].label || idx + 1}"?`)) return
    setSeq(seq.filter((_, i) => i !== idx))
  }

  function updateStep(idx: number, patch: Partial<RecallStep>) {
    setSeq(seq.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function moveStep(idx: number, dir: 'up' | 'down') {
    const next = [...seq]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setSeq(next)
  }

  // Validação antes de salvar
  function validate(): string | null {
    if (enabled && seq.length === 0) {
      return 'Adicione ao menos uma etapa de recall antes de ativar.'
    }
    const activeSteps = seq.filter((s) => s.ativo)
    if (enabled && activeSteps.length === 0) {
      return 'Ative ao menos uma etapa ou desative o recall.'
    }
    for (const s of activeSteps) {
      if (!s.template.trim()) {
        return `A etapa "${s.label || 'sem nome'}" está ativa mas não tem mensagem configurada.`
      }
    }
    // Verificar se dias estão em ordem crescente (apenas aviso)
    const dias = activeSteps.map((s) => s.dias)
    for (let i = 1; i < dias.length; i++) {
      if (dias[i] <= dias[i - 1]) {
        return `As etapas devem ter dias em ordem crescente. A etapa ${i + 1} tem ${dias[i]} dias, mas a anterior tem ${dias[i - 1]} dias.`
      }
    }
    return null
  }

  async function save() {
    const err = validate()
    if (err) {
      alert(err)
      return
    }
    setSaving(true)
    setSavedAt(null)
    try {
      // Salva recall_seq + mantém campos legados para compatibilidade
      // (o cron usa recall_seq quando existe, senão cai no legado)
      const firstActiveStep = seq.find((s) => s.ativo)
      const { error } = await supabase
        .from('clinic_automations')
        .update({
          recall_inativos: enabled,
          recall_seq: seq,
          // Mantém legado sincronizado com a 1ª etapa ativa (fallback)
          recall_dias: firstActiveStep?.dias ?? 150,
          template_recall: firstActiveStep?.template ?? '',
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
      setTestMsg({ kind: 'err', text: 'Informe um telefone para teste (com DDD, ex: 5534999999999)' })
      return
    }
    const step = seq[testStepIdx]
    if (!step) {
      setTestMsg({ kind: 'err', text: 'Selecione uma etapa para testar.' })
      return
    }
    if (!step.template.trim()) {
      setTestMsg({ kind: 'err', text: 'A etapa selecionada não tem mensagem configurada.' })
      return
    }
    setTesting(true)
    setTestMsg(null)
    try {
      const text = renderPreview(step.template, step.dias, clinicName)
        .replace(/Maria Aparecida da Silva/g, 'Você (teste)')
        .replace(/Maria/g, 'Você')
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
            Todo dia às 10h o sistema verifica pacientes inativos e envia as mensagens
            configuradas abaixo de acordo com o tempo sem visita. Cada etapa é enviada uma única
            vez por paciente.
          </p>
        </div>
      </label>

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>

        {/* Explicação da lógica */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-4">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <Icon name="info" className="w-4 h-4" />
            Como funciona a sequência
          </p>
          <ul className="space-y-1 text-amber-700 text-xs list-disc list-inside">
            <li>
              Cada etapa tem um número de dias de inatividade. Quando o paciente atinge aquele
              tempo sem voltar, recebe a mensagem.
            </li>
            <li>
              As etapas são independentes e contam sempre a partir da <strong>última visita</strong>.
            </li>
            <li>
              Se o paciente voltar à clínica, o ciclo reinicia e ele pode receber as etapas
              novamente no futuro.
            </li>
            <li>
              Cada etapa é enviada no máximo 1 vez por ciclo de inatividade.
            </li>
          </ul>
        </div>

        {/* Sequência de etapas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">Etapas de recall</p>
              <p className="text-sm text-slate-500">
                {seq.filter((s) => s.ativo).length} de {seq.length} ativa
                {seq.filter((s) => s.ativo).length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg border border-violet-200 hover:bg-violet-100 transition-colors"
            >
              <Icon name="plus" className="w-4 h-4" />
              Adicionar etapa
            </button>
          </div>

          {seq.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <p className="text-slate-400 text-sm">
                Nenhuma etapa configurada.
                <br />
                Clique em "Adicionar etapa" para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {seq.map((step, idx) => (
                <StepCard
                  key={idx}
                  step={step}
                  index={idx}
                  total={seq.length}
                  clinicName={clinicName}
                  onChange={(patch) => updateStep(idx, patch)}
                  onRemove={() => removeStep(idx)}
                  onMoveUp={() => moveStep(idx, 'up')}
                  onMoveDown={() => moveStep(idx, 'down')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bloco de teste */}
        {seq.length > 0 && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
            <p className="font-semibold text-sm text-slate-900 mb-1">Enviar teste</p>
            <p className="text-xs text-slate-500 mb-3">
              Teste qualquer etapa antes de ativar.
            </p>
            <div className="flex gap-2 mb-2 flex-wrap">
              {seq.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTestStepIdx(i)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    testStepIdx === i
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                  }`}
                >
                  {s.label || `Etapa ${i + 1}`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Ex: 5534999999999"
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={sendTest}
                disabled={testing || !seq[testStepIdx]?.template?.trim()}
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
        )}
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
