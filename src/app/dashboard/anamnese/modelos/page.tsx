import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import ModelosList from './modelos-list'

export const dynamic = 'force-dynamic'

export default async function AnamneseModelosPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin', 'manager'].includes(userData?.role || '')) redirect('/dashboard/anamnese')

  const { data: templates } = await supabase
    .from('anamnese_templates')
    .select('*, anamnese_template_fields(count)')
    .eq('clinic_id', userData?.clinic_id)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: config } = await supabase
    .from('anamnese_config')
    .select('ativo, titulo')
    .eq('clinic_id', userData?.clinic_id)
    .maybeSingle()

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/anamnese" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-900">Minhas Fichas de Anamnese</h1>
          <p className="text-slate-500">Escolha quais fichas ficam disponíveis pra enviar aos pacientes</p>
        </div>
      </div>

      <ModelosList
        initialTemplates={templates || []}
        padrao={{ ativo: config?.ativo !== false, titulo: config?.titulo || 'Ficha de Anamnese Facial' }}
      />
    </div>
  )
}
