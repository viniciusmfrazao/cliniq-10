import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import PatientInfo from './patient-info'
import MedicalSection from './medical-section'
import InjectablesSection from './injectables-section'
import ProductsSection from './products-section'
import FinishAppointment from './finish-appointment'

export default async function AtendimentoPage({ params }: { params: { appointmentId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, name')
    .eq('id', user.id)
    .single()

  // Buscar agendamento com dados do paciente e procedimento
  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      *,
      patients(*),
      procedures(name, duration_minutes, price),
      users(name)
    `)
    .eq('id', params.appointmentId)
    .single()

  if (!appointment) notFound()

  // Buscar produtos da clinica para uso no atendimento
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .eq('is_active', true)
    .gt('current_stock', 0)
    .order('name')

  // Buscar produtos ja usados neste atendimento
  const { data: usedProducts } = await supabase
    .from('appointment_products')
    .select('*, products(name, unit)')
    .eq('appointment_id', params.appointmentId)

  // Buscar evolucoes do paciente
  const { data: evolutions } = await supabase
    .from('evolutions')
    .select('*')
    .eq('patient_id', appointment.patient_id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Buscar aplicacoes de injetaveis do paciente
  const { data: injectableApplications } = await supabase
    .from('injectable_applications')
    .select('*, injectable_points(*)')
    .eq('patient_id', appointment.patient_id)
    .order('created_at', { ascending: false })
    .limit(3)

  const patient = appointment.patients
  const procedure = appointment.procedures

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/agenda" 
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <Icon name="arrowLeft" className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Atendimento</h1>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                appointment.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                appointment.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {appointment.status === 'in_progress' ? 'Em andamento' :
                 appointment.status === 'completed' ? 'Finalizado' : 'Agendado'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date(appointment.start_time).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' às '}
              {new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {appointment.status !== 'completed' && (
          <FinishAppointment 
            appointmentId={appointment.id} 
            currentStatus={appointment.status}
            clinicId={userData?.clinic_id}
          />
        )}
      </div>

      {/* Patient Info Card */}
      <PatientInfo patient={patient} procedure={procedure} />

      {/* Main Content - Tabs ou Grid */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {/* Coluna Esquerda - Prontuario */}
        <div className="space-y-6">
          <MedicalSection 
            patient={patient} 
            evolutions={evolutions || []}
            appointmentId={appointment.id}
          />
        </div>

        {/* Coluna Direita - Injetaveis e Produtos */}
        <div className="space-y-6">
          <InjectablesSection 
            patient={patient}
            applications={injectableApplications || []}
            appointmentId={appointment.id}
            clinicId={userData?.clinic_id}
          />
          
          <ProductsSection 
            appointmentId={appointment.id}
            products={products || []}
            usedProducts={usedProducts || []}
            clinicId={userData?.clinic_id}
          />
        </div>
      </div>
    </div>
  )
}
