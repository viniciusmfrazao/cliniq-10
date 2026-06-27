import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AttendanceHeader from './attendance-header'
import MedicalRecordSection from './medical-record-section'
import InjectableMapSection from './injectable-map-section'
import ProductsUsedSection from './products-used-section'
import RoomCostCard from './room-cost-card'
import ReturnScheduler from './return-scheduler'
import { Suspense } from 'react'
import AnamneseSummaryCard from '@/components/anamnese/AnamneseSummaryCard'
import OrcamentosTab from '@/app/dashboard/pacientes/[id]/orcamentos-tab'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import PackageSessionAlert from './package-session-alert'
import OdontogramMapToggle from './odontogram-map-toggle'
import DocumentosAtendimento from './documentos-atendimento'
import RealtimeWatcher from '@/components/RealtimeWatcher'
import SendAnamneseButton from '@/app/dashboard/agenda/send-anamnese-button'
import AnamneseHistorico from './anamnese-historico'

export default async function AtendimentoPage({ params }: { params: { appointmentId: string } }) {
  const { appointmentId } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: appointment } = await supabase
    .from('appointments')
    .select(`*, patients(*), procedures(name, duration_minutes, price)`)
    .eq('id', appointmentId)
    .maybeSingle()

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
    .neq('id', appointmentId)
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
    .eq('appointment_id', appointmentId)

  // Produtos já usados neste atendimento
  const { data: usedProducts } = await supabase
    .from('appointment_products')
    .select('*, products(name, unit)')
    .eq('appointment_id', appointmentId)

  // Módulos ativos da clínica
  const { data: clinicData } = await supabase
    .from('clinics')
    .select('settings')
    .eq('id', userData?.clinic_id || '')
    .maybeSingle()
  const enabledModules: string[] = clinicData?.settings?.active_modules || []
  const hasOdontogram = enabledModules.includes('odontograma')

  // Pacotes ativos do paciente (para mostrar alerta de usar sessão)
  const { data: activePackages } = await supabase
    .from('patient_packages')
    .select('id, name, total_sessions, used_sessions, status')
    .eq('patient_id', patient.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Anamnese mais recente preenchida pelo paciente — se não houver
  // preenchida ainda, mostramos a pendente (pra avisar o profissional
  // que tem ficha esperando preenchimento). Carregamos `responses` pra
  // popular os chips de alerta (gestante, alergias, fumante, ...).
  const { data: latestCompletedAnamnese } = await supabase
    .from('anamneses')
    .select('id, status, responses, completed_at, created_at, viewed_at, whatsapp_sent_at')
    .eq('patient_id', patient.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let latestAnamnese = latestCompletedAnamnese
  if (!latestAnamnese) {
    const { data: pending } = await supabase
      .from('anamneses')
      .select('id, status, responses, completed_at, created_at, viewed_at, whatsapp_sent_at')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    latestAnamnese = pending
  }

  return (
    // Negative margins compensam o padding do <main> (px-4 py-4 md:px-8 md:py-6)
    // pra que o AttendanceHeader sticky encoste no topo do scroll container.
    <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-6 -mb-28 md:-mb-6">
      <AttendanceHeader
        appointment={appointment}
        patient={patient}
        procedure={procedure}
        clinicId={userData?.clinic_id || ''}
      />

      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-4 md:px-8 md:pt-6 pb-28 md:pb-12">
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          {/* Coluna Esquerda - Prontuario + Anamnese mais recente */}
          <div className="space-y-4 md:space-y-6">
            <MedicalRecordSection
              patient={patient}
              appointmentId={appointmentId}
              pastAppointments={pastAppointments || []}
              medicalRecords={medicalRecords || []}
              clinicId={userData?.clinic_id || ''}
              professionalId={user.id}
              hasIaModule={enabledModules.includes('ia_prontuario')}
            />

            {/* Pacotes ativos — alerta para usar sessão */}
            {activePackages && activePackages.length > 0 && (
              <PackageSessionAlert
                packages={activePackages}
                clinicId={userData?.clinic_id || ''}
                appointmentId={appointmentId}
              />
            )}

            {latestAnamnese ? (
              <AnamneseSummaryCard
                anamnese={latestAnamnese}
                variant="full"
                highlightRecent
                returnUrl={`/dashboard/atendimento/${params.appointmentId}`}
              />
            ) : (
              <div className="card p-5 border-dashed">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="file" className="w-5 h-5 text-violet-500" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-slate-900">Anamnese</h2>
                      <p className="text-xs text-slate-500">Esse paciente ainda não tem ficha.</p>
                    </div>
                  </div>
                  <SendAnamneseButton
                    patientId={patient.id}
                    patientName={patient.name || ''}
                    patientPhone={patient.phone || null}
                    appointmentId={params.appointmentId}
                    variant="compact"
                  />
                </div>
              </div>
            )}

            {/* Histórico de envios da anamnese */}
            <AnamneseHistorico
              patientId={patient.id}
              latestAnamnese={latestAnamnese}
            />

            {/* Orçamentos do paciente */}
            {userData?.clinic_id && (
              <Suspense fallback={<div className="card p-4 animate-pulse h-24" />}>
                <OrcamentosAtendimentoServer
                  patientId={patient.id}
                  clinicId={userData.clinic_id}
                  patient={patient}
                />
              </Suspense>
            )}

            {/* Documentos do atendimento */}
            {userData?.clinic_id && (
              <DocumentosAtendimento
                patientId={patient.id}
                patientName={patient.name}
                patientPhone={patient.phone}
                appointmentId={appointmentId}
                procedureName={appointment.procedures?.name || null}
                clinicId={userData.clinic_id}
              />
            )}

            {/* Agendamento de Retorno */}
            <ReturnScheduler
              patientId={patient.id}
              clinicId={userData?.clinic_id || ''}
              currentAppointmentId={appointmentId}
              professionalId={appointment.professional_id || null}
            />
          </div>

          {/* Coluna Direita - Mapa de Injetaveis / Odontograma + Produtos */}
          <div className="space-y-6">
            {hasOdontogram && (
              <OdontogramMapToggle
                hasOdontogram={hasOdontogram}
                patientId={patient.id}
                clinicId={userData?.clinic_id || ''}
                appointmentId={appointmentId}
                patient={patient}
                productsForMap={productsForMap || []}
                currentInjections={currentInjections || []}
              />
            )}
            {!hasOdontogram && <InjectableMapSection
              patient={patient}
              appointmentId={appointmentId}
              products={productsForMap || []}
              currentInjections={currentInjections || []}
              clinicId={userData?.clinic_id || ''}
            />}

            {/* Produtos Utilizados (seringas, fios, materiais) */}
            <ProductsUsedSection
              appointmentId={appointmentId}
              patientId={patient.id}
              clinicId={userData?.clinic_id || ''}
              products={productsForMap || []}
              usedProducts={usedProducts || []}
            />

            {/* Custo da sala */}
            <RoomCostCard appointmentId={appointmentId} initialCost={appointment.room_cost || 0} />

          </div>
        </div>
      </div>
    </div>
  )
}

async function OrcamentosAtendimentoServer({
  patientId,
  clinicId,
  patient,
}: {
  patientId: string
  clinicId: string
  patient: any
}) {
  const supabase = await createClient()
  const { data: orcamentos } = await supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*)')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .single()

  return (
    <OrcamentosTab
      patientId={patientId}
      clinicId={clinicId}
      patientName={patient.name}
      patientPhone={patient.phone}
      clinicName={clinic?.name || 'Clínica'}
      initialOrcamentos={orcamentos || []}
    />
  )
}
