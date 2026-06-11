import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnamneseConfigForm from './anamnese-config-form'

export default async function AnamneseConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.clinic_id) redirect('/login')
  const clinicId = userData.clinic_id

  let { data: config } = await supabase
    .from('anamnese_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  // Cria config padrão se não existir
  if (!config) {
    const { data: newConfig } = await supabase
      .from('anamnese_config')
      .insert({ clinic_id: clinicId })
      .select()
      .single()
    config = newConfig
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <AnamneseConfigForm config={config} clinicId={clinicId} />
    </div>
  )
}
