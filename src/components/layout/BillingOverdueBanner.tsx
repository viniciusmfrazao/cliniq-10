import { createServiceClient } from '@/lib/supabase/server'

const GRACE_DAYS = 7

/**
 * Banner que avisa quando o pagamento da assinatura (Asaas) venceu e ainda
 * não foi regularizado. Só aparece pra clínicas que já têm um registro em
 * clinic_subscriptions (fluxo de cobrança novo) — clínicas legadas sem
 * assinatura não são afetadas.
 *
 * O bloqueio de fato (redirect pra /planos) acontece em dashboard/layout.tsx
 * depois de GRACE_DAYS dias vencidos; aqui só o aviso, pra dar tempo da
 * clínica regularizar sem ser surpreendida.
 */
export default async function BillingOverdueBanner({
  clinicId,
  role,
}: {
  clinicId: string
  role: string
}) {
  if (!['admin', 'manager', 'super_admin'].includes(role)) return null

  const svc = createServiceClient()

  const { data: clinic } = await svc
    .from('clinics')
    .select('plan_expires_at, clinic_subscriptions(status, asaas_checkout_url)')
    .eq('id', clinicId)
    .maybeSingle()

  const sub = Array.isArray(clinic?.clinic_subscriptions) ? clinic.clinic_subscriptions[0] : null
  if (!sub || !clinic?.plan_expires_at) return null

  const daysOverdue = Math.floor((Date.now() - new Date(clinic.plan_expires_at).getTime()) / 86400000)
  if (daysOverdue < 0 || daysOverdue > GRACE_DAYS) return null

  const daysLeft = GRACE_DAYS - daysOverdue
  const checkoutUrl = sub.asaas_checkout_url as string | null

  return (
    <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs md:text-sm text-amber-800 font-medium">
        ⚠️ Pagamento pendente — {daysLeft > 0
          ? `seu acesso será bloqueado em ${daysLeft} dia${daysLeft === 1 ? '' : 's'} se não for regularizado.`
          : 'seu acesso será bloqueado hoje se não for regularizado.'}
      </p>
      {checkoutUrl && (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded-lg whitespace-nowrap"
        >
          Regularizar agora
        </a>
      )}
    </div>
  )
}
