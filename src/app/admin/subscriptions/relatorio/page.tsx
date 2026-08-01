import { createServiceClient } from '@/lib/supabase/server'
import RelatorioClient from './relatorio-client'

export const dynamic = 'force-dynamic'

export default async function RelatorioPage() {
  const svc = createServiceClient()

  const { data: events } = await svc
    .from('clinic_payment_events')
    .select('clinic_id, event, billing_type, value, occurred_at, clinics(name)')
    .order('occurred_at', { ascending: false })
    .limit(1000)

  const { data: subscriptions } = await svc
    .from('clinic_subscriptions')
    .select('clinic_id, status, plan_name, plan_price, billing_cycle, current_period_start, current_period_end, last_payment_at, last_payment_value, clinics(name)')
    .order('current_period_end', { ascending: true, nullsFirst: false })

  return <RelatorioClient events={events || []} subscriptions={subscriptions || []} />
}
