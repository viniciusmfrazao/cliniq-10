import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/**
 * Banner que aparece no topo do dashboard quando o WhatsApp da clinica
 * esta com health_warning. Detecta sessoes "fantasma" da Evolution
 * (Baileys caiu silenciosamente) E drift de URL do webhook (mais comum
 * apos mudanca de dominio).
 *
 * So aparece pra admin/manager/super_admin. Renderiza nada em qualquer outro caso.
 */
export default async function WhatsappHealthBanner({
  clinicId,
  role,
}: {
  clinicId: string
  role: string
}) {
  if (!['admin', 'manager', 'super_admin'].includes(role)) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('clinic_whatsapp')
    .select(
      'health_warning, health_reason, last_event_at, status, webhook_actual_url, webhook_expected_url, webhook_last_fixed_at',
    )
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!data?.health_warning) return null

  const reason = (data.health_reason as string | null) || ''
  const lastEvent = data.last_event_at as string | null
  const actualUrl = (data.webhook_actual_url as string | null) || null
  const expectedUrl = (data.webhook_expected_url as string | null) || null

  let title = 'WhatsApp pode estar fora do ar'
  let description = 'O sistema detectou problemas na conexão com o WhatsApp da clínica.'
  let severity: 'amber' | 'red' | 'blue' = 'amber'
  let cta: { label: string; href: string } = {
    label: 'Verificar conexão →',
    href: '/dashboard/config/whatsapp',
  }

  if (reason === 'webhook_url_drift_fixed') {
    severity = 'blue'
    title = 'WhatsApp reconfigurado automaticamente'
    description =
      'O endereço do webhook estava apontando pra um domínio antigo e o sistema corrigiu sozinho. As mensagens dos pacientes voltam a chegar agora. Se algo ficou pendente, mande "Refixar webhook" no painel pra reforçar.'
    cta = { label: 'Ver detalhes', href: '/dashboard/config/whatsapp' }
  } else if (reason.startsWith('webhook_drift_error')) {
    severity = 'red'
    title = 'Falha ao consertar webhook do WhatsApp'
    description =
      'O webhook está apontando pra um domínio errado e o sistema não conseguiu corrigir automaticamente. Use o botão "Refixar webhook" ou "Reset total" no painel.'
    cta = { label: 'Corrigir agora →', href: '/dashboard/config/whatsapp' }
  } else if (reason === 'evolution_state_close' || reason === 'instance_not_found') {
    severity = 'red'
    title = 'WhatsApp desconectado'
    description =
      'A conexão com o WhatsApp foi encerrada. Mensagens de pacientes não estão chegando.'
    cta = { label: 'Reconectar →', href: '/dashboard/config/whatsapp' }
  } else if (reason.startsWith('no_events_')) {
    const hours = parseInt(reason.replace('no_events_', '').replace('h', ''), 10) || 24
    severity = 'amber'
    title = 'WhatsApp não recebe mensagens há mais de ' + hours + 'h'
    description =
      'O sistema acha que está conectado, mas há ' +
      hours +
      'h não chega nenhuma mensagem. Possivelmente o pareamento expirou no celular.'
    cta = { label: 'Verificar →', href: '/dashboard/config/whatsapp' }
  } else if (reason.startsWith('evolution_error')) {
    severity = 'amber'
    title = 'Erro de conexão com o WhatsApp'
    description =
      'O servidor de WhatsApp está retornando erros. Pode ser instabilidade temporária.'
  }

  const lastEventLabel = lastEvent
    ? new Date(lastEvent).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'nunca'

  // Quando o caso eh drift, mostramos as URLs envolvidas (so pra admin)
  const showDriftDetails =
    role === 'admin' &&
    (reason === 'webhook_url_drift_fixed' || reason.startsWith('webhook_drift_error'))

  const palette =
    severity === 'red'
      ? {
          bg: 'bg-red-50 dark:bg-red-900/30',
          border: 'border-red-300 dark:border-red-700',
          icon: 'text-red-600',
          title: 'text-red-900 dark:text-red-100',
          body: 'text-red-800 dark:text-red-200',
          subtle: 'text-red-700 dark:text-red-300',
          btn: 'bg-red-600 hover:bg-red-700',
        }
      : severity === 'blue'
        ? {
            bg: 'bg-blue-50 dark:bg-blue-900/30',
            border: 'border-blue-300 dark:border-blue-700',
            icon: 'text-blue-600',
            title: 'text-blue-900 dark:text-blue-100',
            body: 'text-blue-800 dark:text-blue-200',
            subtle: 'text-blue-700 dark:text-blue-300',
            btn: 'bg-blue-600 hover:bg-blue-700',
          }
        : {
            bg: 'bg-amber-50 dark:bg-amber-900/30',
            border: 'border-amber-300 dark:border-amber-700',
            icon: 'text-amber-600',
            title: 'text-amber-900 dark:text-amber-100',
            body: 'text-amber-800 dark:text-amber-200',
            subtle: 'text-amber-700 dark:text-amber-300',
            btn: 'bg-amber-600 hover:bg-amber-700',
          }

  return (
    <div className={`${palette.bg} border-b ${palette.border} px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">
          {severity === 'red' ? '🚨' : severity === 'blue' ? 'ℹ️' : '⚠️'}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${palette.title}`}>{title}</p>
          <p className={`text-xs ${palette.body} mt-0.5`}>
            {description}
            {!showDriftDetails && (
              <span className={`block mt-1 ${palette.subtle}`}>
                Última mensagem recebida: <strong>{lastEventLabel}</strong>
              </span>
            )}
            {showDriftDetails && actualUrl && expectedUrl && (
              <span className={`block mt-2 text-[11px] font-mono ${palette.subtle} break-all`}>
                Antigo: <strong>{actualUrl}</strong>
                <br />
                Novo: <strong>{expectedUrl}</strong>
              </span>
            )}
          </p>
        </div>
        <Link
          href={cta.href}
          className={`flex-shrink-0 px-3 py-1.5 ${palette.btn} text-white rounded-lg text-xs font-semibold whitespace-nowrap`}
        >
          {cta.label}
        </Link>
      </div>
    </div>
  )
}
