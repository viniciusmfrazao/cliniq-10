import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AutomacoesClient from './automacoes-client'

export const dynamic = 'force-dynamic'

export default async function AutomacoesPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.clinic_id) redirect('/dashboard')
  if (!['admin', 'manager'].includes(userRow.role)) {
    redirect('/dashboard/config')
  }

  const clinicId = userRow.clinic_id

  const [{ data: automation }, { data: whatsapp }, { data: clinic }, { data: procedures }] = await Promise.all([
    supabase.from('clinic_automations').select('*').eq('clinic_id', clinicId).maybeSingle(),
    supabase
      .from('clinic_whatsapp')
      .select('status')
      .eq('clinic_id', clinicId),
    supabase.from('clinics').select('id, name').eq('id', clinicId).maybeSingle(),
    supabase
      .from('procedures')
      .select('id, name, is_consulta, active')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true }),
  ])

  // Cobertura de procedimento na base de pacientes. `appointments.procedure_id`
  // só passou a ser preenchido em mai/2026 — quem sumiu antes disso não tem
  // procedimento identificado e só é alcançado pelas etapas gerais do recall.
  // A tela mostra o número real da clínica em vez de deixar o usuário
  // descobrir sozinho que a regra não pegou ninguém.
  const [{ count: totalPacientes }, { count: comProcedimento }] = await Promise.all([
    supabase
      .from('patient_last_completed')
      .select('patient_id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId),
    supabase
      .from('patient_last_completed')
      .select('patient_id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .not('procedure_id', 'is', null),
  ])

  return (
    <AutomacoesClient
      clinicId={clinicId}
      clinicName={clinic?.name || 'Clínica'}
      auto={automation}
      whatsappConnected={(whatsapp ?? []).some((w: { status: string }) => w.status === 'connected')}
      procedures={procedures ?? []}
      procStats={{
        total: totalPacientes ?? 0,
        comProcedimento: comProcedimento ?? 0,
      }}
    />
  )
}
