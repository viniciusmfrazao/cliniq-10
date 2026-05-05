import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/**
 * Banner que aparece no topo do dashboard quando o WhatsApp da clinica
 * esta com health_warning. Detecta sessoes "fantasma" da Evolution
 * (Baileys caiu silenciosamente).
 *
 * So aparece pra admin/manager. Renderiza nada em qualquer outro caso.
 */
export default async function WhatsappHealthBanner({
  clinicId,
  role,
}: {
  clinicId: string
  role: string
}) {
  if (!['admin', 'manager'].includes(role)) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('clinic_whatsapp')
    .select('health_warning, health_reason, last_event_at, status')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!data?.health_warning) return null

  const reason = (data.health_reason as string | null) || ''
  const lastEvent = data.last_event_at as string | null

  let title = 'WhatsApp pode estar fora do ar'
  let description = 'O sistema detectou problemas na conexão com o WhatsApp da clínica.'

  if (reason === 'evolution_state_close' || reason === 'instance_not_found') {
    title = 'WhatsApp desconectado'
    description = 'A conexão com o WhatsApp foi encerrada. Mensagens de pacientes não estão chegando.'
  } else if (reason.startsWith('no_events_')) {
    const hours = parseInt(reason.replace('no_events_', '').replace('h', ''), 10) || 24
    title = 'WhatsApp não recebe mensagens há mais de ' + hours + 'h'
    description = 'O sistema acha que está conectado, mas há '
      + hours
      + 'h não chega nenhuma mensagem. Possivelmente o pareamento expirou no celular.'
  } else if (reason.startsWith('evolution_error')) {
    title = 'Erro de conexão com o WhatsApp'
    description = 'O servidor de WhatsApp está retornando erros. Pode ser instabilidade temporária.'
  }

  const lastEventLabel = lastEvent
    ? new Date(lastEvent).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'nunca'

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">⚠️</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-amber-900 dark:text-amber-100">{title}</p>
          <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
            {description}
            <span className="block mt-1 text-amber-700 dark:text-amber-300">
              Última mensagem recebida: <strong>{lastEventLabel}</strong>
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/config/whatsapp"
          className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
        >
          Verificar conexão →
        </Link>
      </div>
    </div>
  )
}
