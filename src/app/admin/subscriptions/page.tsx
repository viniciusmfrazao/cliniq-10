import { createServiceClient } from '@/lib/supabase/server'
import SubscriptionsClient from './subscriptions-client'

export default async function SubscriptionsPage() {
  const svc = createServiceClient()

  const { data: clinics } = await svc
    .from('clinics')
    .select(`
      id, name, created_at, trial_ends_at, plan_expires_at, billing_whatsapp,
      clinic_subscriptions(status, plan_name, plan_price, billing_cycle, checkout_sent_at, last_payment_at, asaas_checkout_url, trial_ends_at)
    `)
    .order('created_at', { ascending: false })

  const { data: plans } = await svc.from('plans').select('id, name, display_name, price_monthly, price_yearly').eq('active', true).order('price_monthly')

  return <SubscriptionsClient clinics={clinics || []} plans={plans || []} />
}


