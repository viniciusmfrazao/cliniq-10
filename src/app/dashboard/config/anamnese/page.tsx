import { createClient } from '@/lib/supabase/server'
import AnamneseConfigForm from './anamnese-config-form'

export default async function AnamneseConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()
  const clinicId = userData?.clinic_id

  const { data: config } = await supabase
    .from('anamnese_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurar Ficha de Anamnese</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Personalize o título, cores, seções e perguntas extras da sua ficha.
        </p>
      </div>
      <AnamneseConfigForm clinicId={clinicId!} initialConfig={config} />
    </div>
  )
}
