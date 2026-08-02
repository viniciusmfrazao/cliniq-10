import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import TemplateBuilder from './template-builder'

export const dynamic = 'force-dynamic'

export default async function AnamneseModeloBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin', 'manager'].includes(userData?.role || '')) redirect('/dashboard/anamnese')

  const { data: template } = await supabase
    .from('anamnese_templates')
    .select('*')
    .eq('id', id)
    .eq('clinic_id', userData?.clinic_id)
    .single()

  if (!template) notFound()

  const { data: fields } = await supabase
    .from('anamnese_template_fields')
    .select('*')
    .eq('template_id', id)
    .order('ordem', { ascending: true })

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/anamnese/modelos" className="p-2 hover:bg-slate-100 rounded-xl transition">
          <Icon name="arrowLeft" className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{template.nome}</h1>
          <p className="text-slate-500">Monte as perguntas dessa ficha</p>
        </div>
      </div>

      <TemplateBuilder template={template} initialFields={fields || []} />
    </div>
  )
}
