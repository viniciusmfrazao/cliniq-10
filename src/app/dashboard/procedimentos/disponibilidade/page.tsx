import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DisponibilidadeClient from './disponibilidade-client'
import BackButton from '@/components/ui/BackButton'

export const dynamic = 'force-dynamic'

export default async function DisponibilidadePage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('clinic_id, role').eq('id', user.id).single()
  if (!userData?.clinic_id) redirect('/dashboard')

  const clinicId = userData.clinic_id

  // Procedimentos que têm restrição de datas (Lavieen, Hipro, Cursos, Pacientes
  // Modelo, etc.) — qualquer procedimento que só existe em dias específicos.
  const { data: procedures } = await supabase
    .from('procedures')
    .select('id, name')
    .eq('clinic_id', clinicId)
    .or('name.ilike.%lavieen%,name.ilike.%hipro%,name.ilike.%hi pro%,name.ilike.%curso%,name.ilike.%modelo%')
    .order('name')

  // Datas já cadastradas
  const { data: dates } = await supabase
    .from('procedure_available_dates')
    .select('id, procedure_id, available_date, notes')
    .eq('clinic_id', clinicId)
    .gte('available_date', new Date().toISOString().split('T')[0])
    .order('available_date')

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton href="/dashboard/procedimentos" label="Procedimentos" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dias disponíveis — Aparelhos, Cursos e Pacientes Modelo</h1>
        <p className="text-sm text-slate-500 mt-1">
          Defina os dias que o Lavieen e Hipro estarão disponíveis, as datas das próximas turmas de curso, e os dias de
          cada paciente modelo (ex: turma de Botox, Preenchimento, Bioestimulador do Face Art).
          A Eva só oferece esses procedimentos nos dias cadastrados aqui — fora deles, ela nem propõe.
        </p>
      </div>
      <DisponibilidadeClient
        clinicId={clinicId}
        procedures={procedures || []}
        initialDates={dates || []}
      />
    </div>
  )
}
