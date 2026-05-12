import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TaxasForm from './taxas-form'

export default async function TaxasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()

  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData?.role || ''))
    redirect('/dashboard')

  const { data: taxas } = await supabase
    .from('taxas_pagamento')
    .select('*')
    .eq('clinic_id', userData!.clinic_id)
    .order('forma')

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Taxas de Pagamento</h1>
        <p className="text-slate-500 mt-1">Configure as taxas de cartão, Pix e outras formas de pagamento.</p>
      </div>
      <TaxasForm clinicId={userData!.clinic_id} initialTaxas={taxas || []} />
    </div>
  )
}
