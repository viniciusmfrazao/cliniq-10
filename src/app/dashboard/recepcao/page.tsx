import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReceptionView from './reception-view'
import { todayBR, startOfDayBR, endOfDayBR } from '@/lib/datetime'

export default async function RecepcaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  // Sempre fuso de Brasilia: nao confunde "hoje" quando o servidor esta em UTC
  const today = todayBR()
  const todayStart = startOfDayBR(today)
  const todayEnd = endOfDayBR(today)

  // Buscar agendamentos de hoje
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      *,
      patients(id, name, phone, photo_url, cpf, birth_date),
      procedures(name, duration_minutes, price),
      professional:users!appointments_professional_id_fkey(id, name)
    `)
    .eq('clinic_id', userData?.clinic_id)
    .gte('start_time', todayStart)
    .lte('start_time', todayEnd)
    .neq('status', 'cancelled')
    .order('start_time')

  // Buscar TODOS os usuários e filtrar no código (evita problemas com enum)
  // admin NÃO é profissional
  const PROFESSIONAL_ROLES = ['doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist', 'dentist']
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, role, professional_role, active')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')
  
  const professionals = (allUsers || []).filter(u => 
    (PROFESSIONAL_ROLES.includes(u.role) || PROFESSIONAL_ROLES.includes(u.professional_role || '')) && u.active !== false
  )

  return (
    <div className="max-w-6xl mx-auto">
      <ReceptionView 
        appointments={appointments || []}
        professionals={professionals || []}
        clinicId={userData?.clinic_id}
      />
    </div>
  )
}
