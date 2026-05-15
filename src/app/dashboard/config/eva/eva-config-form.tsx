'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

const FOLLOWUP_DEFAULTS = {
  texts: {
    '1': 'Conseguiu dar uma olhadinha nas informações? Se quiser, posso verificar um horário especial pra você e já deixar seu atendimento reservado ✨',
    '2': 'Passei aqui pra te lembrar que o cuidado com você é uma prioridade — qualquer dúvida estou por perto ✨',
    '3': 'Tudo bem? Quis passar novamente pra saber se posso te ajudar com algo. Vai ser um prazer te receber aqui na clínica ✨',
    '4': 'Às vezes a gente acaba adiando algo que pode fazer tão bem pra autoestima… Se quiser, estou aqui pra te ajudar a dar esse primeiro passo olhando algum horário pra você ✨',
    '5': 'Como não tive retorno estou encerrando nosso atendimento por aqui, mas fico à disposição sempre que precisar ✨ Vai ser um prazer te receber!',
  },
  minutes: {
    '1': 120,    // 2h
    '2': 1440,   // 24h
    '3': 2880,   // 48h
    '4': 7200,   // 5d
    '5': 14400,  // 10d
  },
} as const

const PERSONALIDADE_DEFAULT = `- Acolhedora, feminina, elegante e sofisticada — nunca fria, nunca robótica.
- Linguagem leve e envolvente, em português brasileiro.
- Vendedora sutil — você conduz, nunca pressiona.
- Transmite exclusividade.
- Valoriza a especialista da clínica como referência.`

const D1_DEFAULT = `(Nome), amanhã é o seu dia aqui na clínica.

Seu horário às (horas) já está separado especialmente pra você e estamos deixando tudo preparado com muito cuidado.

Tenho certeza que você vai sair muito feliz. ✨`

type EvaCfg = {
  personalidade?: string | null
  confirmation_d1?: string | null
  followup_texts?: Partial<Record<'1' | '2' | '3' | '4' | '5', string>> | null
  followup_minutes?: Partial<Record<'1' | '2' | '3' | '4' | '5', number>> | null
  discount_policy?: string | null
  qualifying_questions?: string | null
}

const DISCOUNT_PLACEHOLDER = `Exemplo (ajuste para a sua realidade):
- À vista (Pix/dinheiro): 10% de desconto sobre o valor cheio
- Pacote de 5 sessões do mesmo procedimento: 15% off
- Indicação de amiga que fechar: R$ 100 de bônus pra ambas

Deixe vazio se NÃO quiser que a Eva ofereça nenhum desconto.`

const QUALIFYING_PLACEHOLDER = `Uma pergunta por linha. A Eva vai escolher UMA delas pra fazer antes de informar o preço.

Exemplos:
Você já fez algum procedimento estético antes?
É a primeira vez que vai cuidar dessa região?
Como você ficou sabendo da gente?
O que te motivou a buscar isso agora?`

type Props = {
  clinicId: string
  clinicName: string
  settings: Record<string, unknown>
}

const STAGE_LABELS: Record<'1' | '2' | '3' | '4' | '5', string> = {
  '1': 'Estágio 1 — após paciente parar de responder',
  '2': 'Estágio 2 — após estágio 1 sem resposta',
  '3': 'Estágio 3 — após estágio 2 sem resposta',
  '4': 'Estágio 4 — após estágio 3 sem resposta',
  '5': 'Estágio 5 (último) — antes de encerrar',
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

export default function EvaConfigForm({ clinicId, clinicName, settings }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const initial = (settings.eva ?? {}) as EvaCfg

  const [personalidade, setPersonalidade] = useState<string>(
    initial.personalidade ?? PERSONALIDADE_DEFAULT
  )
  const [personalidadeModificada, setPersonalidadeModificada] = useState(
    !!(initial.personalidade && initial.personalidade !== PERSONALIDADE_DEFAULT)
  )
  const [confirmacaoD1, setConfirmacaoD1] = useState<string>(initial.confirmation_d1 ?? '')
  const [followupTexts, setFollowupTexts] = useState<Record<'1' | '2' | '3' | '4' | '5', string>>({
    '1': initial.followup_texts?.['1'] ?? '',
    '2': initial.followup_texts?.['2'] ?? '',
    '3': initial.followup_texts?.['3'] ?? '',
    '4': initial.followup_texts?.['4'] ?? '',
    '5': initial.followup_texts?.['5'] ?? '',
  })
  const [followupMinutes, setFollowupMinutes] = useState<Record<'1' | '2' | '3' | '4' | '5', number>>({
    '1': initial.followup_minutes?.['1'] ?? FOLLOWUP_DEFAULTS.minutes['1'],
    '2': initial.followup_minutes?.['2'] ?? FOLLOWUP_DEFAULTS.minutes['2'],
    '3': initial.followup_minutes?.['3'] ?? FOLLOWUP_DEFAULTS.minutes['3'],
    '4': initial.followup_minutes?.['4'] ?? FOLLOWUP_DEFAULTS.minutes['4'],
    '5': initial.followup_minutes?.['5'] ?? FOLLOWUP_DEFAULTS.minutes['5'],
  })
  const [discountPolicy, setDiscountPolicy] = useState<string>(initial.discount_policy ?? '')
  const [qualifyingQuestions, setQualifyingQuestions] = useState<string>(initial.qualifying_questions ?? '')

  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const evaCfg: EvaCfg = {
        personalidade: personalidade.trim() || PERSONALIDADE_DEFAULT,
        confirmation_d1: confirmacaoD1.trim() || null,
        followup_texts: {
          '1': followupTexts['1'].trim() || null,
          '2': followupTexts['2'].trim() || null,
          '3': followupTexts['3'].trim() || null,
          '4': followupTexts['4'].trim() || null,
          '5': followupTexts['5'].trim() || null,
        } as EvaCfg['followup_texts'],
        followup_minutes: {
          '1': Math.max(1, Number(followupMinutes['1']) || FOLLOWUP_DEFAULTS.minutes['1']),
          '2': Math.max(1, Number(followupMinutes['2']) || FOLLOWUP_DEFAULTS.minutes['2']),
          '3': Math.max(1, Number(followupMinutes['3']) || FOLLOWUP_DEFAULTS.minutes['3']),
          '4': Math.max(1, Number(followupMinutes['4']) || FOLLOWUP_DEFAULTS.minutes['4']),
          '5': Math.max(1, Number(followupMinutes['5']) || FOLLOWUP_DEFAULTS.minutes['5']),
        },
        discount_policy: discountPolicy.trim() || null,
        qualifying_questions: qualifyingQuestions.trim() || null,
      }

      const newSettings = { ...settings, eva: evaCfg }
      const { error: upErr } = await supabase
        .from('clinics')
        .update({ settings: newSettings })
        .eq('id', clinicId)

      if (upErr) throw upErr
      setSavedAt(Date.now())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  function resetToDefaults() {
    setPersonalidade(PERSONALIDADE_DEFAULT)
    setConfirmacaoD1(D1_DEFAULT)
    setFollowupTexts({ ...FOLLOWUP_DEFAULTS.texts })
    setFollowupMinutes({ ...FOLLOWUP_DEFAULTS.minutes })
    setDiscountPolicy('')
    setQualifyingQuestions('')
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard/config" className="text-slate-500 hover:text-slate-700">
          <Icon name="chevronLeft" className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Icon name="sparkles" className="w-6 h-6 text-violet-500" />
          Configurações da Eva
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Ajuste a personalidade, templates e tempos de follow-up de <strong>{clinicName}</strong>.
        Campos vazios usam os valores padrão (recomendados).
      </p>

      {/* Personalidade */}
      <div className="card p-5 mb-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="font-semibold text-slate-900">Personalidade da Eva</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Define o tom de todas as mensagens. Use bullet points (um por linha começando com &quot;-&quot;).
            </p>
          </div>
          {personalidadeModificada && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
              Personalizada
            </span>
          )}
        </div>

        <textarea
          value={personalidade}
          onChange={(e) => {
            setPersonalidade(e.target.value)
            setPersonalidadeModificada(e.target.value.trim() !== PERSONALIDADE_DEFAULT.trim())
          }}
          rows={7}
          className="w-full mt-3 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300"
        />

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-400">
            {personalidade.split('\n').filter(l => l.trim().startsWith('-')).length} instruções ativas
          </p>
          <button
            type="button"
            onClick={() => {
              setPersonalidade(PERSONALIDADE_DEFAULT)
              setPersonalidadeModificada(false)
            }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              personalidadeModificada
                ? 'border-violet-300 text-violet-600 hover:bg-violet-50 font-medium'
                : 'border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
          >
            ↩ Restaurar padrão
          </button>
        </div>

        {/* Preview do que a Eva vai usar */}
        {personalidadeModificada && (
          <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
            <p className="text-xs font-medium text-violet-700 mb-1">Personalidade ativa (personalizada):</p>
            <p className="text-xs text-violet-600 whitespace-pre-line">{personalidade}</p>
          </div>
        )}
      </div>

      {/* Política de desconto */}
      <div className="card p-5 mb-4">
        <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <span className="text-base">💰</span> Política de desconto
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          O que a Eva pode oferecer quando a paciente <strong>perguntar explicitamente</strong> sobre desconto/condição especial.
          Escreva em linguagem natural — a Eva interpreta. <strong>Vazio = Eva continua dizendo &quot;vou confirmar com a Dra.&quot;</strong>
        </p>
        <textarea
          value={discountPolicy}
          onChange={(e) => setDiscountPolicy(e.target.value)}
          placeholder={DISCOUNT_PLACEHOLDER}
          rows={6}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
          ⚠️ A Eva só menciona desconto se a paciente perguntar primeiro. Ela nunca oferece de proativamente.
        </p>
      </div>

      {/* Perguntas antes do preço */}
      <div className="card p-5 mb-4">
        <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <span className="text-base">💬</span> Perguntas antes de informar preço
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Quando a paciente perguntar preço pela <strong>primeira vez</strong>, a Eva escolhe <strong>UMA</strong> dessas perguntas pra fazer antes — pra criar conexão e qualificar o lead.
          Uma pergunta por linha. <strong>Vazio = Eva passa a parcela direto.</strong>
        </p>
        <textarea
          value={qualifyingQuestions}
          onChange={(e) => setQualifyingQuestions(e.target.value)}
          placeholder={QUALIFYING_PLACEHOLDER}
          rows={6}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          💡 Eva só faz a pergunta na 1ª vez que a paciente perguntar preço naquela conversa. Se ela voltar e perguntar de novo, vai direto pra parcela.
        </p>
      </div>

      {/* Confirmação D-1 */}
      <div className="card p-5 mb-4">
        <h2 className="font-semibold text-slate-900 mb-1">
          Mensagem de confirmação D-1 <span className="text-xs text-slate-400 font-normal">(véspera do agendamento)</span>
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Use <code className="px-1 bg-slate-100 rounded">(Nome)</code> e <code className="px-1 bg-slate-100 rounded">(horas)</code> como placeholders. Quebras de linha permitidas.
        </p>
        <textarea
          value={confirmacaoD1}
          onChange={(e) => setConfirmacaoD1(e.target.value)}
          placeholder={D1_DEFAULT}
          rows={6}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button
          type="button"
          onClick={() => setConfirmacaoD1(D1_DEFAULT)}
          className="text-xs text-violet-600 hover:underline mt-2"
        >
          Restaurar padrão
        </button>
      </div>

      {/* Follow-up: 5 estagios */}
      <div className="card p-5 mb-4">
        <h2 className="font-semibold text-slate-900 mb-1">Follow-up automático (5 estágios)</h2>
        <p className="text-xs text-slate-500 mb-4">
          Cada estágio dispara depois de N minutos sem resposta.
          Após o estágio 5 sem resposta, o lead vira <strong>Perdido</strong>.
        </p>

        {(['1', '2', '3', '4', '5'] as const).map((stage) => (
          <div key={stage} className="mb-5 pb-5 border-b border-slate-100 last:border-0 last:pb-0 last:mb-0">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm text-slate-900">{STAGE_LABELS[stage]}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={followupMinutes[stage]}
                  onChange={(e) =>
                    setFollowupMinutes((prev) => ({ ...prev, [stage]: parseInt(e.target.value) || 0 }))
                  }
                  className="w-20 px-2 py-1 text-sm border border-slate-200 rounded text-right"
                />
                <span className="text-xs text-slate-500">min ({fmtMinutes(followupMinutes[stage])})</span>
              </div>
            </div>
            <textarea
              value={followupTexts[stage]}
              onChange={(e) => setFollowupTexts((prev) => ({ ...prev, [stage]: e.target.value }))}
              placeholder={FOLLOWUP_DEFAULTS.texts[stage]}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            setFollowupTexts({ ...FOLLOWUP_DEFAULTS.texts })
            setFollowupMinutes({ ...FOLLOWUP_DEFAULTS.minutes })
          }}
          className="text-xs text-violet-600 hover:underline"
        >
          Restaurar todos os textos e tempos padrão
        </button>
      </div>

      {error && (
        <div className="card p-3 mb-4 bg-red-50 border-red-200 text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-6"
        >
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          Restaurar TODOS os padrões
        </button>
        {savedAt && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <Icon name="check" className="w-4 h-4" /> Salvo!
          </span>
        )}
      </div>

      <div className="mt-6 p-4 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-800">
        <p className="font-semibold mb-1">💡 Como isso funciona</p>
        <p className="text-xs leading-relaxed">
          As configurações são lidas a cada conversa pela Edge Function da Eva.
          Mudanças entram em vigor no próximo turno (não precisa redeploy).
          Se um campo ficar vazio, a Eva usa o texto padrão.
        </p>
      </div>
    </div>
  )
}
