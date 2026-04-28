'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

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
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const hasPhone = !!patientPhone?.trim()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)

    try {
      const r = await fetch('/api/anamnese/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, appointmentId }),
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
