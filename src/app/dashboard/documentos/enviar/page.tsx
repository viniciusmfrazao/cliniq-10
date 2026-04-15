import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import SendDocumentForm from './send-form'

export default async function EnviarDocumentoPage({ searchParams }: { searchParams: { patient?: string; appointment?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', userData?.clinic_id)
    .single()

  const { data: templates } = await supabase
    .from('document_templates')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .eq('is_active', true)
    .order('name')

  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, email, phone, cpf')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/documentos" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Enviar Documento</h1>
          <p className="text-sm text-slate-500 mt-0.5">Selecione o paciente e o documento</p>
        </div>
      </div>

      <SendDocumentForm
        clinicId={userData?.clinic_id || ''}
        clinicName={clinic?.name || ''}
        templates={templates || []}
        patients={patients || []}
        userId={user.id}
        preSelectedPatient={searchParams.patient}
        appointmentId={searchParams.appointment}
      />
    </div>
  )
}
