import { createServiceClient } from '@/lib/supabase/server'
import SubscriptionsClient from './subscriptions-client'


export const dynamic = 'force-dynamic'

export default async function SubscriptionsPage() {
  const svc = createServiceClient()

  const { data: clinics } = await svc
    .from('clinics')
    .select(`
      id, name, cnpj, settings, created_at, trial_ends_at, plan_expires_at, billing_whatsapp,
      clinic_subscriptions(status, plan_name, plan_price, billing_cycle, checkout_sent_at, last_payment_at, asaas_checkout_url, payment_method, trial_ends_at)
    `)
    .order('created_at', { ascending: false })

  const { data: plans } = await svc.from('plans').select('id, name, display_name, price_monthly, price_yearly').eq('active', true).order('price_monthly')

  const { data: paymentEvents } = await svc
    .from('clinic_payment_events')
    .select('clinic_id, event, billing_type, value, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(500)

  const eventsByClinic: Record<string, any[]> = {}
  for (const ev of paymentEvents || []) {
    if (!eventsByClinic[ev.clinic_id]) eventsByClinic[ev.clinic_id] = []
    eventsByClinic[ev.clinic_id].push(ev)
  }

  return <SubscriptionsClient clinics={clinics || []} plans={plans || []} eventsByClinic={eventsByClinic} />
}


