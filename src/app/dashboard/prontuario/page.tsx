import { createClient } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import Link from 'next/link'
import PatientSearchProntuario from './patient-search'

export default async function ProntuarioPage({ 
  searchParams 
}: { 
  searchParams: { q?: string } 
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

  let query = supabase
    .from('patients')
    .select('*, evolutions(count)')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  if (searchParams.q) {
    query = query.or(`name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%`)
  }

  const { data: patients } = await query.limit(30)

  const clinicPatients = await getAllPatients<{ id: string }>(
    supabase,
    userData?.clinic_id,
    'id'
  )

  const patientIds = clinicPatients.map(p => p.id)

  // Buscar últimas evoluções apenas dos pacientes da clínica
  const { data: recentEvolutions } = patientIds.length > 0 
    ? await supabase
        .from('evolutions')
        .select('*, patients(name)')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Prontuario</h1>
        <p className="text-sm text-slate-500 mt-0.5">Busque um paciente para abrir o prontuario</p>
      </div>

      <div className="card p-4 mb-6">
        <PatientSearchProntuario initialQuery={searchParams.q || ''} />
      </div>

      {searchParams.q ? (
        <div className="card divide-y divide-slate-100">
          <div className="p-4 bg-slate-50">
            <p className="text-sm font-medium text-slate-700">
              Resultados para "{searchParams.q}"
            </p>
          </div>
          {patients?.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">Nenhum paciente encontrado</p>
            </div>
          ) : (
            patients?.map(patient => (
              <Link 
                key={patient.id} 
                href={`/dashboard/prontuario/${patient.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-700 font-semibold">
                    {patient.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{patient.name}</p>
                  <p className="text-xs text-slate-500">{patient.phone || patient.email || 'Sem contato'}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {patient.evolutions?.[0]?.count || 0} evolucoes
                </span>
              </Link>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Ultimas evolucoes</h2>
            {recentEvolutions?.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhuma evolucao registrada</p>
            ) : (
              <div className="space-y-3">
                {recentEvolutions?.map(evo => (
                  <Link 
                    key={evo.id}
                    href={`/dashboard/prontuario/${evo.patient_id}`}
                    className="block p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-900">{evo.patients?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{evo.title}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(evo.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Acesso rapido</h2>
            <div className="space-y-2">
              <Link 
                href="/dashboard/pacientes"
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <span className="text-xl">👥</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Lista de pacientes</p>
                  <p className="text-xs text-slate-500">Ver todos os pacientes</p>
                </div>
              </Link>
              <Link 
                href="/dashboard/agenda"
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <span className="text-xl">📅</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Agenda do dia</p>
                  <p className="text-xs text-slate-500">Pacientes de hoje</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
