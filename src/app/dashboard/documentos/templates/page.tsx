import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import TemplatesList from './templates-list'

export default async function TemplatesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  const { data: templates } = await supabase
    .from('document_templates')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/documentos" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Templates de Documentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Modelos para termos e contratos</p>
        </div>
        <Link href="/dashboard/documentos/templates/novo" className="btn-primary w-auto px-4 flex items-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          Novo template
        </Link>
      </div>

      <TemplatesList templates={templates || []} clinicId={userData?.clinic_id || ''} />
    </div>
  )
}
