/**
 * calendar-links.ts
 *
 * Geração de links "adicionar à agenda" SEM OAuth — não requer conta Google
 * conectada, token, nem cron de renovação. É só um link/arquivo com os dados
 * do agendamento; quem clica adiciona na própria agenda (Google, Apple,
 * Outlook, etc).
 *
 * IMPORTANTE — extensibilidade futura:
 * Isso é independente de uma futura integração OAuth (sync bidirecional,
 * bloqueio de agenda pessoal do profissional, etc). Essa função não assume
 * nem bloqueia nada disso — se um dia existir uma tabela tipo
 * `professional_google_integrations` com sync via API, ela conviverá em
 * paralelo com esses links, que continuam sendo o fallback universal (não
 * depende de o profissional/paciente ter conectado nada).
 */

/** Formata uma data ISO para o formato UTC exigido pelo Google Calendar / ICS: YYYYMMDDTHHMMSSZ */
function toUtcCompact(iso: string): string {
  const d = new Date(iso)
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

/** Escapa texto para uso em campos ICS (vírgula, ponto-e-vírgula, quebras de linha) */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
}

/** Quebra linhas ICS em 75 octetos (folding), exigido pelo RFC 5545 */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  let result = ''
  let remaining = line
  let first = true
  while (remaining.length > 0) {
    const chunkSize = first ? 75 : 74
    result += (first ? '' : '\r\n ') + remaining.slice(0, chunkSize)
    remaining = remaining.slice(chunkSize)
    first = false
  }
  return result
}

export type CalendarEventInput = {
  /** Identificador único e estável (ex: appointment.id) — usado como UID no ICS */
  id: string
  title: string
  description?: string
  location?: string
  /** ISO 8601 com timezone (ex: appointment.start_time) */
  startTimeISO: string
  /** ISO 8601 com timezone (ex: appointment.end_time) */
  endTimeISO: string
}

export type CalendarLinks = {
  /** Abre o Google Calendar (web ou app) já preenchido — fluxo mais direto no Android/Chrome */
  googleUrl: string
  /** URL do endpoint que gera o .ics sob demanda — funciona em qualquer calendário (iOS, Outlook, etc) */
  icsUrl: string
}

/**
 * Gera o link direto do Google Calendar (action=TEMPLATE).
 * Não requer OAuth nem conta conectada — abre a tela de criação de evento
 * pré-preenchida na conta Google já logada no dispositivo de quem clica.
 */
export function generateGoogleCalendarUrl(event: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toUtcCompact(event.startTimeISO)}/${toUtcCompact(event.endTimeISO)}`,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Gera o conteúdo de um arquivo .ics (RFC 5545) para o evento.
 * Universal — funciona com Google Calendar, Apple Calendar, Outlook, etc.
 */
export function generateIcsContent(event: CalendarEventInput): string {
  const now = toUtcCompact(new Date().toISOString())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clinike//Agendamentos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@clinike.com.br`,
    `DTSTAMP:${now}`,
    `DTSTART:${toUtcCompact(event.startTimeISO)}`,
    `DTEND:${toUtcCompact(event.endTimeISO)}`,
    `SUMMARY:${icsEscape(event.title)}`,
  ]
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`)
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

/**
 * Monta os dois links a partir de um appointment já resolvido (com nomes já
 * carregados — clinicName, professionalName, procedureName). Usar isso no
 * ponto de chamada (cron de confirmação, dashboard, etc) para não acoplar
 * esse módulo a queries de banco.
 */
export function buildAppointmentCalendarEvent(params: {
  appointmentId: string
  clinicName: string
  professionalName?: string | null
  procedureName?: string | null
  startTimeISO: string
  endTimeISO: string
}): CalendarEventInput {
  const title = params.procedureName
    ? `${params.procedureName} - ${params.clinicName}`
    : `Consulta - ${params.clinicName}`

  const descriptionParts = [`Atendimento em ${params.clinicName}`]
  if (params.professionalName) descriptionParts.push(`Profissional: ${params.professionalName}`)

  return {
    id: params.appointmentId,
    title,
    description: descriptionParts.join('\n'),
    location: params.clinicName,
    startTimeISO: params.startTimeISO,
    endTimeISO: params.endTimeISO,
  }
}

export function getPublicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.clinike.com.br').replace(/\/$/, '')
}

export function generateCalendarLinks(baseUrl: string, event: CalendarEventInput): CalendarLinks {
  return {
    googleUrl: generateGoogleCalendarUrl(event),
    icsUrl: `${baseUrl}/api/calendar/${event.id}/ics`,
  }
}
