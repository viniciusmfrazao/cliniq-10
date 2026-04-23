import { createClient } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import AppointmentForm from '../appointment-form'

export default async function NovoAgendamentoPage({ 
  searchParams 
}: { 
  searchParams: { patient?: string; date?: string; time?: string; professional?: string } 
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
    .select('id, name, duration_minutes, price')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  // Buscar TODOS os usuários e filtrar no código (evita problemas com enum)
  // admin NÃO é profissional
  const PROFESSIONAL_ROLES = ['doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist']
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, role, active')
    .eq('clinic_id', userData?.clinic_id)
  
  const professionals = (allUsers || []).filter(u => 
    PROFESSIONAL_ROLES.includes(u.role) && u.active !== false
  )

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)

  return (
    <div className="max-w-2xl mx-auto">
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
        />
      </div>
    </div>
  )
}
