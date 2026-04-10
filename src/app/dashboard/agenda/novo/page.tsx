import { createClient } from '@/lib/supabase/server'
import AppointmentForm from '../appointment-form'

export default async function NovoAgendamentoPage({ 
  searchParams 
}: { 
  searchParams: { patient?: string; date?: string; time?: string } 
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

  // Buscar dados para os selects
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  const { data: procedures } = await supabase
    .from('procedures')
    .select('id, name, duration_minutes, price')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  const { data: professionals } = await supabase
    .from('users')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .in('role', ['admin', 'doctor', 'esthetician'])

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
        />
      </div>
    </div>
  )
}
