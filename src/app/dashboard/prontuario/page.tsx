import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PatientSearchProntuario from './patient-search'

export default async function ProntuarioPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

  // Lista de pacientes (com busca opcional + contagem de evolucoes)
  let query = supabase
    .from('patients')
    .select('id, name, phone, email, created_at, evolutions(count)')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  if (searchParams.q) {
    query = query.or(`name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%`)
  }

  const { data: patients } = await query.limit(50)

  // Ultimas 5 evolucoes da clinica (atalho)
  const { data: recentEvolutions } = await supabase
    .from('evolutions')
    .select('id, patient_id, title, created_at, patients!inner(name, clinic_id)')
    .eq('patients.clinic_id', userData?.clinic_id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Prontuarios</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Selecione um paciente abaixo para abrir o prontuario completo
        </p>
      </div>

      <div className="card p-4 mb-6">
        <PatientSearchProntuario initialQuery={searchParams.q || ''} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lista de pacientes - sempre visivel */}
        <div className="lg:col-span-2">
          <div className="card divide-y divide-slate-100">
            <div className="p-4 bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {searchParams.q
                  ? `Resultados para "${searchParams.q}"`
                  : 'Pacientes'}
              </p>
              <span className="text-xs text-slate-500">{patients?.length || 0}</span>
            </div>
            {!patients || patients.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  {searchParams.q ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
                </p>
              </div>
            ) : (
              patients.map(patient => {
                const evoCount = (patient as { evolutions?: { count: number }[] }).evolutions?.[0]?.count || 0
                return (
                  <Link
                    key={patient.id}
                    href={`/dashboard/prontuario/${patient.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
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
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs text-slate-400">
                        {evoCount} {evoCount === 1 ? 'evolucao' : 'evolucoes'}
                      </span>
                      <p className="text-xs text-violet-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Abrir prontuario →
                      </p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Sidebar - ultimas evolucoes */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Ultimas evolucoes</h2>
            {!recentEvolutions || recentEvolutions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhuma evolucao registrada</p>
            ) : (
              <div className="space-y-2">
                {recentEvolutions.map(evo => {
                  const patientName = Array.isArray(evo.patients)
                    ? (evo.patients[0] as { name?: string } | undefined)?.name
                    : (evo.patients as { name?: string } | null)?.name
                  return (
                    <Link
                      key={evo.id}
                      href={`/dashboard/prontuario/${evo.patient_id}`}
                      className="block p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <p className="text-sm font-medium text-slate-900 truncate">{patientName}</p>
                      <p className="text-xs text-slate-500 truncate">{evo.title}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(evo.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
