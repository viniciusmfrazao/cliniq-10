import { createClient } from '@/lib/supabase/server'
import { parseDateBR } from '@/lib/datetime'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { Suspense } from 'react'
import DeletePatientButton from './delete-button'
import PatientTabs, { type PatientTab, isValidTab } from './tabs'
import MedicalInfo from './medical-info'
import EvolutionTimeline from './evolution-timeline'
import NewEvolutionButton from './new-evolution-button'
import OrcamentosTab from './orcamentos-tab'
import PackagesTab from './packages-tab'
import OdontogramTab from './odontogram-tab'
import DocumentosTab from './documentos-tab'
import RealtimeWatcher from '@/components/RealtimeWatcher'
import AnamnesePresencialButton from './anamnese-presencial-button'

/**
 * Central do Paciente.
 *
 * Unifica o que antes estava espalhado em /dashboard/prontuario/[id],
 * /dashboard/pacientes/[id] e /dashboard/injetaveis/[patientId].
 * A tab ativa vem de ?tab=...; default = "overview".
 *
 * Cada tab busca só os dados que precisa (queries em paralelo). As
 * contagens pros badges das tabs vêm de count queries leves no header.
 */
export default async function PatientCentralPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const id = params.id
  const currentTab: PatientTab = isValidTab(searchParams.tab) ? searchParams.tab : 'overview'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, id, name')
    .eq('id', user!.id)
    .maybeSingle()

  // Header + dados base do paciente (incluindo contagens pra os badges
  // e o próximo atendimento "vivo" do paciente — em andamento ou
  // aguardando — pra mostrar o atalho "Continuar atendimento").
  const [
    patientResult,
    medicalRecordResult,
    evolutionsCountResult,
    completedAppointmentsCountResult,
    anamnesesCountResult,
    applicationsCountResult,
    activeAppointmentResult,
    packagesCountResult,
    documentsCountResult,
  ] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).maybeSingle(),
    supabase.from('medical_records').select('*').eq('patient_id', id).maybeSingle(),
    supabase
      .from('evolutions')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id),
    supabase
      .from('anamneses')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id),
    supabase
      .from('injectable_applications')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id),
    supabase
      .from('appointments')
      .select('id, status, start_time')
      .eq('patient_id', id)
      .in('status', ['in_progress', 'confirmed'])
      .gte('start_time', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('patient_packages')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id)
      .eq('status', 'active'),
    supabase
      .from('documents_sent')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id),
  ])

  const activeAppointment = activeAppointmentResult.data

  const patient = patientResult.data
  if (!patient) notFound()

  // medical_records tem UNIQUE(patient_id) — se não existe, criamos uma vez
  let medicalRecord = medicalRecordResult.data
  if (!medicalRecord) {
    const { data: created } = await supabase
      .from('medical_records')
      .insert({ clinic_id: userData?.clinic_id, patient_id: id })
      .select()
      .maybeSingle()
    medicalRecord = created
  }

  // Verificar módulos ativos da clínica via active_modules
  const { data: clinicData } = await supabase
    .from('clinics')
    .select('settings')
    .eq('id', userData?.clinic_id || '')
    .single()

  const enabledModules: string[] = clinicData?.settings?.active_modules || []

  const counts = {
    evolucoes: evolutionsCountResult.count || 0,
    consultas: completedAppointmentsCountResult.count || 0,
    anamneses: anamnesesCountResult.count || 0,
    injetaveis: applicationsCountResult.count || 0,
    pacotes: packagesCountResult.count || 0,
    documentos: documentsCountResult.count || 0,
  }

  const age = patient.birth_date
    ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000)
    : null

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <Link href="/dashboard/pacientes" className="hover:text-slate-700">
          Pacientes
        </Link>
        <span>›</span>
        <span className="text-slate-700">{patient.name}</span>
      </div>

      {/* Header do paciente */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-pink-400 rounded-2xl flex items-center justify-center overflow-hidden">
            {patient.photo_url && /^https?:\/\//.test(patient.photo_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={patient.photo_url} alt="" className="w-14 h-14 object-cover" />
            ) : (
              <span className="text-white text-xl font-bold">
                {patient.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-500">
              {age ? `${age} anos` : ''}
              {patient.gender === 'F'
                ? age
                  ? ' • Feminino'
                  : 'Feminino'
                : patient.gender === 'M'
                  ? age
                    ? ' • Masculino'
                    : 'Masculino'
                  : ''}
              {patient.phone ? ` • ${patient.phone}` : ''}
            </p>
            {patient.tags && patient.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {patient.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeAppointment && (
            <Link
              href={`/dashboard/atendimento/${activeAppointment.id}`}
              className="btn-primary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
              title={
                activeAppointment.status === 'in_progress'
                  ? 'Atendimento em andamento — voltar pra ele'
                  : 'Iniciar o atendimento agendado pra agora'
              }
            >
              <Icon name="play" className="w-4 h-4" />
              {activeAppointment.status === 'in_progress'
                ? 'Continuar atendimento'
                : 'Iniciar atendimento'}
            </Link>
          )}
          <Link
            href={`/dashboard/agenda?patient=${id}`}
            className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
            title="Abrir agenda já com o paciente selecionado"
          >
            <Icon name="calendar" className="w-4 h-4" />
            Agendar consulta
          </Link>
          <Link
            href={`/dashboard/pacientes/${id}/editar`}
            className="btn-secondary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <Icon name="edit" className="w-4 h-4" />
            Editar cadastro
          </Link>
          <DeletePatientButton patientId={id} />
        </div>
      </div>

      {/* Realtime — atualiza ficha quando anamnese, evolução ou agendamento muda */}
      <RealtimeWatcher table="anamneses" column="patient_id" value={id} />
      <RealtimeWatcher table="evolutions" column="patient_id" value={id} />
      <RealtimeWatcher table="appointments" column="patient_id" value={id} />
      <RealtimeWatcher table="patient_packages" column="patient_id" value={id} />

      {/* Tabs */}
      <PatientTabs patientId={id} current={currentTab} counts={counts} />

      {/* Conteúdo da tab ativa */}
      {currentTab === 'overview' && (
        <>
          <OverviewTab patient={patient} medicalRecord={medicalRecord} patientId={id} />
          <div className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              {userData?.clinic_id && patient && (
                <DocumentosTab
                  patientId={id}
                  patientName={patient.name}
                  patientPhone={patient.phone}
                  clinicId={userData.clinic_id}
                />
              )}
            </Suspense>
          </div>
          <div className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              {userData?.clinic_id && (
                <OrcamentosTabServer patientId={id} clinicId={userData.clinic_id} patient={patient} />
              )}
            </Suspense>
          </div>
        </>
      )}
      {currentTab === 'evolucoes' && (
        <Suspense fallback={<TabSkeleton />}>
          <EvolucoesTab
            patientId={id}
            clinicId={userData?.clinic_id || ''}
            professionalId={userData?.id || ''}
            professionalName={userData?.name || ''}
          />
        </Suspense>
      )}
      {currentTab === 'consultas' && (
        <Suspense fallback={<TabSkeleton />}>
          <ConsultasTab patientId={id} />
        </Suspense>
      )}
      {currentTab === 'anamneses' && (
        <Suspense fallback={<TabSkeleton />}>
          <AnamnesesTab patientId={id} />
        </Suspense>
      )}
      {currentTab === 'injetaveis' && (
        <Suspense fallback={<TabSkeleton />}>
          <InjetaveisTab patientId={id} />
        </Suspense>
      )}
      {currentTab === 'documentos' && (
        <Suspense fallback={<TabSkeleton />}>
          {userData?.clinic_id && patient && (
            <DocumentosTab
              patientId={id}
              patientName={patient.name}
              patientPhone={patient.phone}
              clinicId={userData.clinic_id}
            />
          )}
        </Suspense>
      )}
      {currentTab === 'odontograma' && enabledModules.includes('odontograma') && (
        <Suspense fallback={<TabSkeleton />}>
          {userData?.clinic_id && (
            <OdontogramTab patientId={id} clinicId={userData.clinic_id} />
          )}
        </Suspense>
      )}
      {currentTab === 'pacotes' && (
        <Suspense fallback={<TabSkeleton />}>
          {userData?.clinic_id && (
            <PackagesTabServer patientId={id} clinicId={userData.clinic_id} />
          )}
        </Suspense>
      )}
    </div>
  )
}

function TabSkeleton() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="h-4 w-32 bg-slate-100 rounded mb-3" />
      <div className="h-3 w-full bg-slate-100 rounded mb-2" />
      <div className="h-3 w-2/3 bg-slate-100 rounded" />
    </div>
  )
}

// ============================================================
// Tabs
// ============================================================

function OverviewTab({
  patient,
  medicalRecord,
  patientId,
}: {
  patient: {
    email: string | null
    cpf: string | null
    birth_date: string | null
    address: string | null
    city: string | null
    state: string | null
    zip_code: string | null
    notes: string | null
  }
  medicalRecord: Parameters<typeof MedicalInfo>[0]['medicalRecord']
  patientId: string
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-6">
        <MedicalInfo medicalRecord={medicalRecord} patientId={patientId} />
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Contato</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-slate-900">{patient.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">CPF</p>
              <p className="text-slate-900">{patient.cpf || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Nascimento</p>
              <p className="text-slate-900">
                {patient.birth_date
                  ? parseDateBR(patient.birth_date)
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Endereço</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400">Endereço</p>
              <p className="text-slate-900">{patient.address || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">CEP</p>
              <p className="text-slate-900">{patient.zip_code || '-'}</p>
            </div>
            <div className="sm:col-span-3">
              <p className="text-xs text-slate-400">Cidade / Estado</p>
              <p className="text-slate-900">
                {patient.city || '-'}
                {patient.state ? ` / ${patient.state}` : ''}
              </p>
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Observações</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

async function EvolucoesTab({
  patientId,
  clinicId,
  professionalId,
  professionalName,
}: {
  patientId: string
  clinicId: string
  professionalId: string
  professionalName: string
}) {
  const supabase = await createClient()
  // Evoluções e anamneses em paralelo — vão pro mesmo timeline e ficam
  // misturadas por data no client.
  const [{ data: evolutions }, { data: anamneses }] = await Promise.all([
    supabase
      .from('evolutions')
      .select('*, users(name)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('anamneses')
      .select('id, status, responses, completed_at, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),
  ])

  // Signed URLs em batch pras fotos do bucket privado.
  const allPhotoPaths = Array.from(
    new Set(
      ((evolutions ?? []) as Array<{ photos?: string[] | null }>)
        .flatMap((e) => e.photos ?? [])
        .filter((p): p is string => !!p),
    ),
  )
  const photoUrls: Record<string, string> = {}
  if (allPhotoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('medical-attachments')
      .createSignedUrls(allPhotoPaths, 60 * 60)
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) photoUrls[item.path] = item.signedUrl
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-900">Histórico do paciente</h2>
        <NewEvolutionButton
          patientId={patientId}
          clinicId={clinicId}
          professionalId={professionalId}
          professionalName={professionalName}
        />
      </div>
      <EvolutionTimeline
        evolutions={evolutions || []}
        anamneses={anamneses || []}
        photoUrls={photoUrls}
        patientId={patientId}
      />
    </div>
  )
}

async function ConsultasTab({ patientId }: { patientId: string }) {
  const supabase = await createClient()
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status, notes, procedures(name), users(name)')
    .eq('patient_id', patientId)
    .order('start_time', { ascending: false })

  const STATUS: Record<string, { label: string; cls: string }> = {
    scheduled: { label: 'Agendada', cls: 'bg-slate-100 text-slate-700' },
    confirmed: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'Em atendimento', cls: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Realizada', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
    no_show: { label: 'Faltou', cls: 'bg-red-100 text-red-700' },
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Histórico de atendimentos</h2>
      {!appointments || appointments.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Nenhuma consulta registrada
        </p>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => {
            const status = STATUS[apt.status] || STATUS.scheduled
            const procName = Array.isArray(apt.procedures)
              ? apt.procedures[0]?.name
              : (apt.procedures as { name: string } | null)?.name
            const profName = Array.isArray(apt.users)
              ? apt.users[0]?.name
              : (apt.users as { name: string } | null)?.name
            // Atendimento abre o flow profissional; consultas terminadas
            // só linkamos pra agenda (read-only) pra evitar mudar status sem
            // querer.
            const href =
              apt.status === 'in_progress' || apt.status === 'confirmed'
                ? `/dashboard/atendimento/${apt.id}`
                : `/dashboard/agenda/${apt.id}`
            return (
              <Link
                key={apt.id}
                href={href}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {procName || 'Atendimento'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(apt.start_time).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'America/Sao_Paulo',
                    })}{' '}
                    às{' '}
                    {new Date(apt.start_time).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    })}
                    {profName && ` • ${profName}`}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${status.cls}`}
                >
                  {status.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

async function AnamnesesTab({ patientId }: { patientId: string }) {
  const supabase = await createClient()
  const { data: anamneses } = await supabase
    .from('anamneses')
    .select('id, status, sent_by, viewed_at, completed_at, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-900">Fichas de anamnese</h2>
        <div className="flex items-center gap-2">
          <AnamnesePresencialButton patientId={patientId} />
          <Link
            href={`/dashboard/anamnese/enviar?patient=${patientId}`}
            className="btn-primary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            Enviar nova
          </Link>
        </div>
      </div>
      {!anamneses || anamneses.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Nenhuma ficha enviada
        </p>
      ) : (
        <div className="space-y-2">
          {anamneses.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/anamnese/${a.id}?return=${encodeURIComponent(`/dashboard/pacientes/${patientId}`)}`}
              className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors gap-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Enviada em {new Date(a.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </p>
                {a.completed_at && (
                  <p className="text-xs text-slate-500">
                    Preenchida em {new Date(a.completed_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                  a.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : a.status === 'viewed'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {a.status === 'completed'
                  ? 'Preenchida'
                  : a.status === 'viewed'
                    ? 'Visualizada'
                    : 'Pendente'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

async function InjetaveisTab({ patientId }: { patientId: string }) {
  // Por ora, mantemos a tela própria de injetáveis (com mapa facial e
  // criação de aplicações). Aqui só listamos o histórico curto e linkamos.
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from('injectable_applications')
    .select('id, type, product_name, total_units, application_date, users(name)')
    .eq('patient_id', patientId)
    .order('application_date', { ascending: false })
    .limit(20)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-900">Histórico de aplicações</h2>
        <Link
          href={`/dashboard/injetaveis/${patientId}`}
          className="btn-primary w-auto px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Icon name="syringe" className="w-4 h-4" />
          Abrir mapa facial
        </Link>
      </div>
      {!applications || applications.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Nenhuma aplicação registrada. Use o mapa facial pra criar a primeira.
        </p>
      ) : (
        <div className="space-y-2">
          {applications.map((app) => {
            const profName = Array.isArray(app.users)
              ? app.users[0]?.name
              : (app.users as { name: string } | null)?.name
            const typeLabel = app.type === 'toxin' ? 'Toxina' : 'Preenchedor'
            return (
              <div
                key={app.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {app.product_name || typeLabel}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(app.application_date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    {profName && ` • ${profName}`}
                    {app.total_units ? ` • ${app.total_units}U` : ''}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-100 text-purple-700">
                  {typeLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

async function OrcamentosTabServer({
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

async function PackagesTabServer({
  patientId,
  clinicId,
}: {
  patientId: string
  clinicId: string
}) {
  const supabase = await createClient()
  const [packagesResult, proceduresResult] = await Promise.all([
    supabase
      .from('patient_packages')
      .select('*, patient_package_sessions(*)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('procedures')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('name'),
  ])

  return (
    <PackagesTab
      patientId={patientId}
      clinicId={clinicId}
      initialPackages={packagesResult.data || []}
      procedures={proceduresResult.data || []}
    />
  )
}

