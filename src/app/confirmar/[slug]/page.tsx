import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ConfirmarClient from './confirmar-client'

export default async function ConfirmarPage({ params }: { params: { slug: string } }) {
  const svc = createServiceClient()

  const { data: apt } = await svc
    .from('appointments')
    .select(`
      id,
      start_time,
      status,
      confirmed_at,
      confirmation_token,
      clinic_id,
      patients(name),
      procedures(name),
      professionals:users!appointments_professional_id_fkey(name),
      clinics(name, settings)
    `)
    .eq('confirmation_slug', params.slug)
    .maybeSingle()

  if (!apt) return notFound()

  const clinic = apt.clinics as { name: string; settings?: { logo_url?: string } } | null
  const patient = apt.patients as { name: string } | null
  const procedure = apt.procedures as { name: string } | null
  const professional = apt.professionals as { name: string } | null

  const dt = new Date(apt.start_time)
  const dateLabel = dt.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const timeLabel = dt.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <ConfirmarClient
      token={params.slug}
      alreadyConfirmed={apt.status === 'confirmed' || !!apt.confirmed_at}
      isCancelled={apt.status === 'cancelled' || apt.status === 'no_show'}
      patientName={patient?.name || ''}
      clinicName={clinic?.name || ''}
      procedureName={procedure?.name || ''}
      professionalName={professional?.name || ''}
      dateLabel={dateLabel}
      timeLabel={timeLabel}
    />
  )
}
