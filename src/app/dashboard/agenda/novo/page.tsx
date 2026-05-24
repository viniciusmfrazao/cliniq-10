import BackButton from '@/components/ui/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import AppointmentForm from '../appointment-form'

export default async function NovoAgendamentoPage({ 
  searchParams 
}: { 
  searchParams: { patient?: string; date?: string; time?: string; professional?: string; overlap?: string } 
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

  const patients = await getAllPatients<{ id: string; name: string }>(
    supabase,
    userData?.clinic_id,
    'id, name'
  )

  const { data: procedures } = await supabase
    .from('procedures')
    .select('id, name, duration_minutes, price, professional_ids')
    .eq('clinic_id', userData?.clinic_id)
    .eq('active', true)
    .order('name')

  // Buscar TODOS os usuários e filtrar no código (evita problemas com enum)
  // admin NÃO é profissional
  // So mostra quem realmente atende pacientes:
  // - Role puro de profissional (biomedic, esthetician, etc.) OU
  // - Admin/manager com professional_role preenchido (ex: Dra. Sarah = admin + professional_role=biomedic)
  const PURE_PROFESSIONAL_ROLES = ['doctor', 'dentist', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist']
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, role, professional_role, active')
    .eq('clinic_id', userData?.clinic_id)
  
  const professionals = (allUsers || []).filter(u =>
    u.active !== false && (
      PURE_PROFESSIONAL_ROLES.includes(u.role) ||
      (u.professional_role && PURE_PROFESSIONAL_ROLES.includes(u.professional_role))
    )
  )

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton href="/dashboard/agenda" label="Agenda" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Novo agendamento</h1>
        <p className="text-sm text-slate-500 mt-0.5">Preencha os dados do agendamento</p>
      </div>
      <div className="card p-6">
        <AppointmentForm 
          clinicId={userData?.clinic_id}
          patients={patients || []}
          procedures={procedures || []}
          professionals={professionals || []}
          rooms={rooms || []}
          defaultPatientId={searchParams.patient}
          defaultDate={searchParams.date}
          defaultTime={searchParams.time}
          defaultProfessionalId={searchParams.professional}
          allowOverlapDefault={searchParams.overlap === '1'}
        />
      </div>
    </div>
  )
}
