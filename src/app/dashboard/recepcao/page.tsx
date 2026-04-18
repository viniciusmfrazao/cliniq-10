import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReceptionView from './reception-view'

export default async function RecepcaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00`
  const todayEnd = `${today}T23:59:59`

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

  // Buscar profissionais (todos os roles que atendem)
  const { data: professionals } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('clinic_id', userData?.clinic_id)
    .eq('active', true)
    .in('role', ['admin', 'doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist'])
    .order('name')

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
