import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import TemplateForm from '../template-form'

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .maybeSingle()

  const { data: template } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!template) redirect('/dashboard/documentos/templates')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/documentos/templates" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Editar Template</h1>
          <p className="text-sm text-slate-500 mt-0.5">{template.name}</p>
        </div>
      </div>

      <TemplateForm clinicId={userData?.clinic_id || ''} template={template} />
    </div>
  )
}
