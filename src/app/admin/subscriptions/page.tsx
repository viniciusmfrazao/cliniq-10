import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import SubscriptionsClient from './subscriptions-client'

export const dynamic = 'force-dynamic'

export default async function SubscriptionsPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  const svc = createServiceClient()

  const { data: clinics, error: clinicsErr } = await svc
    .from('clinics')
    .select(`
      id, name, cnpj, settings, created_at, trial_ends_at, plan_expires_at, billing_whatsapp,
      clinic_subscriptions(
        status, plan_name, plan_price, billing_cycle, checkout_sent_at, checkout_status,
        last_payment_at, last_payment_value, asaas_checkout_url, asaas_subscription_id, payment_method,
        trial_ends_at, card_registered_at, card_brand, card_last4,
        next_charge_at, next_charge_value, next_charge_status, last_sync_at,
        last_capture_refused_at
      )
    `)
    .order('created_at', { ascending: false })

  if (clinicsErr) {
    console.error('[admin/subscriptions] erro ao buscar clinics+subscriptions:', clinicsErr)
  }

  const { data: plans } = await svc
    .from('plans')
    .select('id, name, display_name, price_monthly, price_yearly')
    .eq('active', true)
    .order('price_monthly')

  const { data: paymentEvents } = await svc
    .from('clinic_payment_events')
    .select('clinic_id, event, billing_type, value, occurred_at, due_date, payment_status')
    .order('occurred_at', { ascending: false })
    .limit(1000)

  const eventsByClinic: Record<string, any[]> = {}
  for (const ev of paymentEvents || []) {
    if (!eventsByClinic[ev.clinic_id]) eventsByClinic[ev.clinic_id] = []
    eventsByClinic[ev.clinic_id].push(ev)
  }

  return <SubscriptionsClient clinics={clinics || []} plans={plans || []} eventsByClinic={eventsByClinic} />
}
