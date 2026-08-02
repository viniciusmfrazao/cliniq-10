'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useAnamneseTemplatePicker, resolveAutoTemplateId, type TemplateOption } from '@/lib/useAnamneseTemplatePicker'

type SendAnamneseResult = {
  ok: boolean
  anamnese_id?: string
  token?: string
  link?: string
  sent?: 'whatsapp' | 'link_only'
  reused?: boolean
  reason?: string
  error?: string
}

type Props = {
  patientId: string
  patientName: string
  patientPhone: string | null
  appointmentId?: string
  /** Variante visual: 'compact' (popover da agenda) ou 'block' (página padrão). */
  variant?: 'compact' | 'block'
}

/**
 * Botão 1-clique pra enviar a anamnese pro paciente via WhatsApp da clínica.
 *
 * - Se a clínica tiver modelos de ficha customizados ativos (além do modelo
 *   fixo padrão), mostra um seletor antes de enviar.
 * - Se já existe uma anamnese pendente/visualizada e ainda válida, reutiliza
 *   (não cria duplicada).
 * - Se a clínica tiver WhatsApp conectado e o paciente tiver telefone, envia
 *   pelo Evolution API automaticamente.
 * - Caso contrário, devolve o link num toast pra copiar.
 */
export default function SendAnamneseButton({
  patientId,
  patientName,
  patientPhone,
  appointmentId,
  variant = 'compact',
}: Props) {
  const toast = useToast()
  const { loadOptions } = useAnamneseTemplatePicker()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [picking, setPicking] = useState(false)
  const [padraoAtiva, setPadraoAtiva] = useState(true)
  const [opcoes, setOpcoes] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('') // '' = ficha padrão (fixa)

  const hasPhone = !!patientPhone?.trim()

  const doSend = async (templateId: string | null) => {
    setLoading(true)
    try {
      const r = await fetch('/api/anamnese/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, appointmentId, templateId: templateId || undefined }),
      })
      const data = (await r.json()) as SendAnamneseResult

      if (!r.ok || !data.ok) {
        toast.error('Não consegui enviar a anamnese', {
          description: data.error || 'Erro inesperado, tenta de novo.',
        })
        return
      }

      const firstName = patientName.trim().split(/\s+/)[0] || 'paciente'

      if (data.sent === 'whatsapp') {
        toast.success(
          data.reused
            ? `Link reenviado pra ${firstName}`
            : `Anamnese enviada pra ${firstName}`,
          {
            description: 'Mensagem disparada via WhatsApp da clínica.',
          },
        )
        setDone(true)
        return
      }

      // Sem WhatsApp: copia link no clipboard e avisa
      if (data.link) {
        try {
          await navigator.clipboard.writeText(data.link)
          toast.success('Link copiado pra área de transferência', {
            description: hasPhone
              ? 'WhatsApp da clínica indisponível. Cola e envia manualmente.'
              : 'Paciente sem telefone. Cola e envia onde preferir.',
          })
        } catch {
          toast.success('Link gerado', {
            description: data.link,
          })
        }
        setDone(true)
        return
      }

      toast.error('Resposta vazia do servidor')
    } catch (err) {
      toast.error('Erro de rede', {
        description: err instanceof Error ? err.message : 'tente novamente',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading || picking) return

    setLoading(true)
    const options = await loadOptions()
    setLoading(false)
    setPadraoAtiva(options.padraoAtiva)
    setOpcoes(options.templates)

    const resolved = resolveAutoTemplateId(options)
    if (resolved.auto) {
      void doSend(resolved.templateId)
      return
    }

    // Mais de 1 ficha disponível: pergunta qual enviar.
    setSelectedTemplateId(options.padraoAtiva ? '' : options.templates[0].id)
    setPicking(true)
  }

  const confirmPick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPicking(false)
    void doSend(selectedTemplateId || null)
  }

  const cancelPick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPicking(false)
  }

  if (picking) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={variant === 'block' ? 'space-y-2' : 'flex-1 space-y-1.5'}
      >
        <select
          className="input text-xs py-1.5 w-full"
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          {padraoAtiva && <option value="">Ficha padrão</option>}
          {opcoes.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={confirmPick}
            className="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg bg-violet-500 text-white hover:bg-violet-600"
          >
            Enviar
          </button>
          <button
            type="button"
            onClick={cancelPick}
            className="py-1.5 px-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (variant === 'block') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60"
      >
        {loading ? (
          <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
        ) : (
          <>
            <Icon name={done ? 'check' : 'share'} className="w-5 h-5" />
            {done ? 'Anamnese enviada' : 'Enviar anamnese'}
          </>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={
        hasPhone
          ? 'Enviar ficha de anamnese via WhatsApp'
          : 'Sem telefone — vai copiar o link pra você enviar manualmente'
      }
      className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-60 ${
        done
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          : 'bg-violet-500 text-white hover:bg-violet-600'
      }`}
    >
      {loading ? (
        <span className="animate-spin w-3 h-3 border-2 border-white/40 border-t-white rounded-full" />
      ) : (
        <Icon name={done ? 'check' : 'file'} className="w-3 h-3" />
      )}
      {done ? 'Enviada' : 'Anamnese'}
    </button>
  )
}
