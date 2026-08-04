import { createServiceClient } from '@/lib/supabase/server'
import SubscriptionsClient from './subscriptions-client'

export const dynamic = 'force-dynamic'

export default async function SubscriptionsPage() {
  const svc = createServiceClient()

  const { data: clinics, error: clinicsErr } = await svc
    .from('clinics')
    .select(`
      id, name, cnpj, settings, created_at, trial_ends_at, plan_expires_at, billing_whatsapp,
      clinic_subscriptions(*)
    `)
    .order('created_at', { ascending: false })

  if (clinicsErr) {
    console.error('[admin/subscriptions] erro ao buscar clinics+subscriptions:', clinicsErr)
  }
  console.log(
    '[admin/subscriptions] clinics:', clinics?.length,
    '| primeiro com sub:', JSON.stringify(clinics?.find((c: any) => c.clinic_subscriptions?.length > 0))
  )

  const { data: plans } = await svc
    .from('plans')
    .select('id, name, display_name, price_monthly, price_yearly')
    .eq('active', true)
    .order('price_monthly')

  const { data: paymentEvents } = await svc
    .from('clinic_payment_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(1000)

  const eventsByClinic: Record<string, any[]> = {}
  for (const ev of paymentEvents || []) {
    if (!eventsByClinic[ev.clinic_id]) eventsByClinic[ev.clinic_id] = []
    eventsByClinic[ev.clinic_id].push(ev)
  }

  return <SubscriptionsClient clinics={clinics || []} plans={plans || []} eventsByClinic={eventsByClinic} />
}
