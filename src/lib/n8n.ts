// Configuração do n8n
const N8N_WEBHOOK_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || ''

type N8nEvent = 
  | 'appointment_created'
  | 'appointment_reminder'
  | 'appointment_checkin'
  | 'patient_birthday'
  | 'lead_created'
  | 'lead_updated'
  | 'package_low'
  | 'nps_request'

type WebhookPayload = {
  event: N8nEvent
  data: Record<string, any>
  timestamp: string
  clinic_id?: string
}

// Envia evento para o n8n
export async function triggerN8nWebhook(
  event: N8nEvent, 
  data: Record<string, any>,
  webhookPath?: string
): Promise<boolean> {
  const webhookUrl = webhookPath 
    ? `${N8N_WEBHOOK_BASE}/${webhookPath}`
    : `${N8N_WEBHOOK_BASE}/cliniq-${event.replace('_', '-')}`

  if (!N8N_WEBHOOK_BASE) {
    console.log(`[n8n] Webhook não configurado. Evento: ${event}`)
    return false
  }

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      console.log(`[n8n] Evento enviado: ${event}`)
      return true
    } else {
      console.error(`[n8n] Erro ao enviar evento: ${response.status}`)
      return false
    }
  } catch (error) {
    console.error(`[n8n] Erro de conexão:`, error)
    return false
  }
}

// Eventos específicos com tipagem

export async function notifyAppointmentCreated(appointment: {
  id: string
  patient_name: string
  patient_phone: string
  professional_name: string
  procedure_name: string
  start_time: string
  clinic_name: string
}) {
  return triggerN8nWebhook('appointment_created', {
    ...appointment,
    message: `Novo agendamento: ${appointment.patient_name} - ${appointment.procedure_name} em ${new Date(appointment.start_time).toLocaleString('pt-BR')}`
  })
}

export async function notifyAppointmentReminder(appointment: {
  id: string
  patient_name: string
  patient_phone: string
  professional_name: string
  procedure_name: string
  start_time: string
  hours_until: number
}) {
  return triggerN8nWebhook('appointment_reminder', {
    ...appointment,
    message: `Lembrete: Sua consulta é ${appointment.hours_until === 24 ? 'amanhã' : `em ${appointment.hours_until} horas`} - ${appointment.procedure_name} com ${appointment.professional_name}`
  })
}

export async function notifyCheckin(appointment: {
  id: string
  patient_name: string
  professional_name: string
  professional_phone?: string
  procedure_name: string
}) {
  return triggerN8nWebhook('appointment_checkin', {
    ...appointment,
    message: `${appointment.patient_name} chegou para ${appointment.procedure_name}`
  })
}

export async function notifyBirthday(patient: {
  id: string
  name: string
  phone: string
  age: number
  clinic_name: string
}) {
  return triggerN8nWebhook('patient_birthday', {
    ...patient,
    message: `Feliz aniversário, ${patient.name.split(' ')[0]}! 🎂 A equipe da ${patient.clinic_name} deseja um dia maravilhoso!`
  })
}

export async function notifyLeadCreated(lead: {
  id: string
  name: string
  phone: string
  email?: string
  source: string
  interest?: string
}) {
  return triggerN8nWebhook('lead_created', {
    ...lead,
    message: `Novo lead: ${lead.name} (${lead.source})`
  })
}

export async function notifyPackageLow(data: {
  patient_name: string
  patient_phone: string
  package_name: string
  remaining_sessions: number
}) {
  return triggerN8nWebhook('package_low', {
    ...data,
    message: `${data.patient_name}, restam apenas ${data.remaining_sessions} sessões do seu pacote de ${data.package_name}. Deseja renovar?`
  })
}

export async function requestNPS(appointment: {
  id: string
  patient_name: string
  patient_phone: string
  professional_name: string
  procedure_name: string
}) {
  return triggerN8nWebhook('nps_request', {
    ...appointment,
    message: `Olá ${appointment.patient_name.split(' ')[0]}! Como foi seu atendimento com ${appointment.professional_name}? Responda de 0 a 10.`
  })
}
