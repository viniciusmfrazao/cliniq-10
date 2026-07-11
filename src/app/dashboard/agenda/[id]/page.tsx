import { createClient, getCachedUser } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import AppointmentActions from './actions'
import { buildAppointmentCalendarEvent, generateCalendarLinks, getPublicBaseUrl } from '@/lib/calendar-links'

export default async function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const user = await getCachedUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).maybeSingle()

  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      *,
      patients(id, name, phone, email, cpf, birth_date),
      procedures(id, name, price),
      users(id, name),
      rooms(id, name, color),
      clinics(name),
      valor_sinal,
      forma_pagamento_sinal
    `)
    .eq('id', id)
    .maybeSingle()

  if (!appointment) notFound()

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

  // Buscar TODOS os usuários e filtrar no código (evita problemas com enum)
  // admin NÃO é profissional
  const PROFESSIONAL_ROLES = ['doctor', 'esthetician', 'biomedic', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist', 'dentist']
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, role, professional_role, active')
    .eq('clinic_id', userData?.clinic_id)
  
  const professionals = (allUsers || []).filter(u => 
    (PROFESSIONAL_ROLES.includes(u.role) || PROFESSIONAL_ROLES.includes(u.professional_role || '')) && u.active !== false
  )

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .eq('active', true)

  const statusLabel: Record<string, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    in_progress: 'Em atendimento',
    completed: 'Realizado',
    cancelled: 'Cancelado',
    no_show: 'Faltou',
  }

  const statusColor: Record<string, string> = {
    scheduled: 'bg-slate-100 text-slate-700',
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-red-100 text-red-700',
  }

  // Verificar se cadastro do paciente está completo
  const patient = appointment.patients as { id: string; name: string; phone: string | null; email: string | null; cpf: string | null; birth_date: string | null } | null
  const isPatientIncomplete = patient && (!patient.cpf || !patient.birth_date)

  // Link "adicionar à agenda" (Google + .ics) — sem OAuth, gerado on-the-fly
  const calendarLinks = appointment.end_time && appointment.status !== 'cancelled'
    ? generateCalendarLinks(
        getPublicBaseUrl(),
        buildAppointmentCalendarEvent({
          appointmentId: appointment.id,
          clinicName: appointment.clinics?.name || 'Clinike',
          professionalName: appointment.users?.name ?? null,
          procedureName: appointment.procedures?.name ?? null,
          startTimeISO: appointment.start_time,
          endTimeISO: appointment.end_time,
        }),
      )
    : null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Detalhes do agendamento</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date(appointment.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo',
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor[appointment.status]}`}>
          {statusLabel[appointment.status]}
        </span>
      </div>

      {/* Alerta de cadastro incompleto */}
      {isPatientIncomplete && (
        <Link 
          href={`/dashboard/pacientes/${patient.id}`}
          className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
              <Icon name="bell" className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">Cadastro pendente</p>
              <p className="text-sm text-amber-700">
                Complete o cadastro de <strong>{patient.name}</strong> 
                {!patient.cpf && !patient.birth_date && ' (CPF e data de nascimento)'}
                {!patient.cpf && patient.birth_date && ' (CPF)'}
                {patient.cpf && !patient.birth_date && ' (data de nascimento)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-amber-700">
            <span className="text-sm font-medium">Completar</span>
            <Icon name="chevronRight" className="w-4 h-4" />
          </div>
        </Link>
      )}

      <div className="card p-6 mb-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1">Paciente</p>
            <Link href={`/dashboard/pacientes/${appointment.patient_id}`} className="text-sm font-medium text-brand-600 hover:underline">
              {appointment.patients?.name}
            </Link>
            {appointment.patients?.phone && (
              <p className="text-xs text-slate-500">{appointment.patients.phone}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">Procedimento</p>
            <p className="text-sm font-medium text-slate-900">
              {appointment.procedures?.name || 'Atendimento'}
            </p>
            {appointment.procedures?.price && (
              <p className="text-xs text-slate-500">R$ {appointment.procedures.price.toFixed(2)}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">Horario</p>
            <p className="text-sm font-medium text-slate-900">
              {new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
              {' - '}
              {new Date(appointment.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">Profissional</p>
            <p className="text-sm font-medium text-slate-900">
              {appointment.users?.name || 'Nao definido'}
            </p>
          </div>

          {appointment.rooms && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Sala</p>
              <p className="text-sm font-medium text-slate-900">{appointment.rooms.name}</p>
            </div>
          )}

          {appointment.notes && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 mb-1">Observacoes</p>
              <p className="text-sm text-slate-600">{appointment.notes}</p>
            </div>
          )}

          {appointment.valor_sinal && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Sinal recebido</p>
              <p className="text-sm font-semibold text-emerald-600">
                R$ {Number(appointment.valor_sinal).toFixed(2).replace('.', ',')}
                <span className="text-xs font-normal text-slate-500 ml-1 capitalize">({appointment.forma_pagamento_sinal})</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {calendarLinks && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-700 mb-3">Adicionar à agenda</p>
          <a
            href={calendarLinks.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 py-2 px-3 text-sm font-medium rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <Icon name="calendar" className="w-4 h-4" />
            Google Agenda
          </a>
        </div>
      )}

      <AppointmentActions 
        appointment={appointment}
        clinicId={userData?.clinic_id}
        patients={patients || []}
        procedures={procedures || []}
        professionals={professionals || []}
        rooms={rooms || []}
      />

      <div className="mt-6">
        <Link href={`/dashboard/agenda?date=${appointment.start_time.split('T')[0]}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar para agenda
        </Link>
      </div>
    </div>
  )
}
