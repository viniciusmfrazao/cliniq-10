import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AttendanceHeader from './attendance-header'
import MedicalRecordSection from './medical-record-section'
import InjectableMapSection from './injectable-map-section'
import ProductsUsedSection from './products-used-section'
import ReturnScheduler from './return-scheduler'

export default async function AtendimentoPage({ params }: { params: { appointmentId: string } }) {
  const supabase = await createClient()
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
    gender?: string | null
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

  // TODOS os produtos com estoque disponível (sem filtro de categoria)
  const { data: productsForMap } = await supabase
    .from('products')
    .select('id, name, brand, current_stock, unit, batch_number, expiry_date, category')
    .eq('clinic_id', userData?.clinic_id)
    .gt('current_stock', 0)
    .order('category')
    .order('name')

  // Aplicacoes de injetaveis deste atendimento
  const { data: currentInjections } = await supabase
    .from('injectable_applications')
    .select('*, injectable_points(*), products(name)')
    .eq('appointment_id', params.appointmentId)

  // Produtos já usados neste atendimento
  const { data: usedProducts } = await supabase
    .from('appointment_products')
    .select('*, products(name, unit)')
    .eq('appointment_id', params.appointmentId)

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <AttendanceHeader
        appointment={appointment}
        patient={patient}
        procedure={procedure}
        clinicId={userData?.clinic_id || ''}
      />

      <div className="max-w-[1600px] mx-auto px-4 py-4 md:py-6 pb-24 md:pb-8">
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          {/* Coluna Esquerda - Prontuario */}
          <MedicalRecordSection
            patient={patient}
            appointmentId={params.appointmentId}
            pastAppointments={pastAppointments || []}
            medicalRecords={medicalRecords || []}
            clinicId={userData?.clinic_id || ''}
            professionalId={user.id}
          />

          {/* Coluna Direita - Mapa de Injetaveis + Produtos */}
          <div className="space-y-6">
            <InjectableMapSection
              patient={patient}
              appointmentId={params.appointmentId}
              products={productsForMap || []}
              currentInjections={currentInjections || []}
              clinicId={userData?.clinic_id || ''}
            />

            {/* Produtos Utilizados (seringas, fios, materiais) */}
            <ProductsUsedSection
              appointmentId={params.appointmentId}
              patientId={patient.id}
              clinicId={userData?.clinic_id || ''}
              products={productsForMap || []}
              usedProducts={usedProducts || []}
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
