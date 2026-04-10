import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import AttendanceHeader from './attendance-header'
import MedicalRecordSection from './medical-record-section'
import InjectableMapSection from './injectable-map-section'
import ReturnScheduler from './return-scheduler'

export default async function AtendimentoPage({ params }: { params: { appointmentId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, name')
    .eq('id', user.id)
    .single()

  const { data: appointment } = await supabase
    .from('appointments')
    .select(`*, patients(*), procedures(name, duration_minutes, price)`)
    .eq('id', params.appointmentId)
    .single()

  if (!appointment) notFound()

  const patient = appointment.patients as {
    id: string
    name: string
    birth_date: string | null
    phone: string | null
    email: string | null
    photo_url?: string | null
    notes?: string | null
  }

  const procedure = appointment.procedures as {
    name: string
    duration_minutes: number
    price: number
  } | null

  // Historico de consultas anteriores
  const { data: pastAppointments } = await supabase
    .from('appointments')
    .select('id, start_time, status, procedures(name)')
    .eq('patient_id', patient.id)
    .neq('id', params.appointmentId)
    .eq('status', 'completed')
    .order('start_time', { ascending: false })
    .limit(10)

  // Evolucoes/prontuarios anteriores
  const { data: medicalRecords } = await supabase
    .from('evolutions')
    .select('*')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Todos os produtos com estoque (para uso no mapa de injetáveis)
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, brand, current_stock, unit, batch_number, expiry_date, category')
    .eq('clinic_id', userData?.clinic_id)
    .gt('current_stock', 0)
    .order('name')

  // Filtrar produtos injetáveis (prioridade) ou mostrar todos se não houver
  const injectableCategories = ['injetavel', 'toxina', 'preenchedor', 'bioestimulador', 'filler']
  const injectableProducts = allProducts?.filter(p => 
    injectableCategories.some(cat => p.category?.toLowerCase().includes(cat))
  )
  
  // Se não encontrar produtos de injetáveis, usar todos os produtos como fallback
  const productsForMap = (injectableProducts && injectableProducts.length > 0) 
    ? injectableProducts 
    : allProducts

  // Aplicacoes de injetaveis deste atendimento
  const { data: currentInjections } = await supabase
    .from('injectable_applications')
    .select('*, injectable_points(*), products(name)')
    .eq('appointment_id', params.appointmentId)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Fixo */}
      <AttendanceHeader
        appointment={appointment}
        patient={patient}
        procedure={procedure}
        clinicId={userData?.clinic_id || ''}
      />

      {/* Conteudo Principal */}
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Prontuario */}
          <MedicalRecordSection
            patient={patient}
            appointmentId={params.appointmentId}
            pastAppointments={pastAppointments || []}
            medicalRecords={medicalRecords || []}
            clinicId={userData?.clinic_id || ''}
            professionalId={user.id}
          />

          {/* Coluna Direita - Mapa de Injetaveis */}
          <div className="space-y-6">
            <InjectableMapSection
              patient={patient}
              appointmentId={params.appointmentId}
              products={productsForMap || []}
              currentInjections={currentInjections || []}
              clinicId={userData?.clinic_id || ''}
            />

            {/* Agendamento de Retorno */}
            <ReturnScheduler
              patientId={patient.id}
              clinicId={userData?.clinic_id || ''}
              currentAppointmentId={params.appointmentId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
