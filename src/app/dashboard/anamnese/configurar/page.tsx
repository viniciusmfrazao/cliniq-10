import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import AnamneseConfigEditor from './anamnese-config-editor'

export default async function AnamneseConfigPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!['admin','super_admin','manager'].includes(userData?.role || '')) redirect('/dashboard/anamnese')

  const clinicId = userData?.clinic_id

  // Busca config existente
  let { data: config } = await supabase
    .from('anamnese_config')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  // Se não existe ainda, cria com padrão
  if (!config) {
    const { data: newConfig } = await supabase
      .from('anamnese_config')
      .insert({ clinic_id: clinicId })
      .select()
      .single()
    config = newConfig
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/anamnese" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Configurar Anamnese</h1>
          <p className="text-slate-500">Personalize as perguntas da sua ficha</p>
        </div>
      </div>
      <AnamneseConfigEditor config={config} clinicId={clinicId} />
    </div>
  )
}
