import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PatientSearchInjectable from './patient-search'
import { sanitizeSearchTerm } from '@/lib/search'

export default async function InjetaveisPage({ 
  searchParams 
}: { 
  searchParams: { q?: string } 
}) {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()

  // Buscar pacientes se tiver query.
  // sanitizeSearchTerm remove caracteres do parser do PostgREST
  // (`,()*\\%_`) que de outra forma poderiam quebrar a query ou
  // estender filtros (ex: `,clinic_id.neq.xxx`).
  let patients: any[] = []
  const safeQuery = sanitizeSearchTerm(searchParams.q)
  if (safeQuery) {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', userData?.clinic_id)
      .or(`name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`)
      .order('name')
      .limit(20)
    patients = data || []
  }

  // Ultimas aplicacoes
  const { data: recentApplications } = await supabase
    .from('injectable_applications')
    .select('*, patients(name), users(name)')
    .eq('clinic_id', userData?.clinic_id)
    .order('application_date', { ascending: false })
    .limit(8)

  // Estatisticas
  const { count: totalApplications } = await supabase
    .from('injectable_applications')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)

  const { count: thisMonth } = await supabase
    .from('injectable_applications')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .gte('application_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Mapa de Injetaveis</h1>
        <p className="text-sm text-slate-500 mt-1">Registro anatomico de toxina botulinica e preenchedores</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
          <p className="text-purple-200 text-xs font-medium uppercase tracking-wide">Total de aplicacoes</p>
          <p className="text-3xl font-bold mt-1">{totalApplications || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Este mes</p>
          <p className="text-3xl font-bold mt-1">{thisMonth || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-5 text-white col-span-2 md:col-span-2">
          <p className="text-pink-200 text-xs font-medium uppercase tracking-wide">Acesso rapido</p>
          <p className="text-lg font-semibold mt-1">Busque um paciente para iniciar</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Buscar paciente</h2>
        <PatientSearchInjectable initialQuery={searchParams.q || ''} />
        
        {searchParams.q && (
          <div className="mt-4">
            {patients.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhum paciente encontrado</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {patients.map(patient => (
                  <Link
                    key={patient.id}
                    href={`/dashboard/injetaveis/${patient.id}`}
                    className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50 transition-all group"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:from-purple-200 group-hover:to-pink-200 transition-all">
                      <span className="text-purple-700 font-bold text-lg">
                        {patient.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{patient.name}</p>
                      <p className="text-xs text-slate-500">{patient.phone || 'Sem telefone'}</p>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Applications */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Ultimas aplicacoes</h2>
        </div>
        
        {!recentApplications || recentApplications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💉</span>
            </div>
            <p className="text-slate-500 font-medium">Nenhuma aplicacao registrada</p>
            <p className="text-sm text-slate-400 mt-1">Busque um paciente para criar o primeiro mapa</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recentApplications.map(app => (
              <Link
                key={app.id}
                href={`/dashboard/injetaveis/${app.patient_id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  app.type === 'toxin' 
                    ? 'bg-purple-100 text-purple-600' 
                    : 'bg-pink-100 text-pink-600'
                }`}>
                  {app.type === 'toxin' ? '💉' : '✨'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{app.patients?.name}</p>
                  <p className="text-xs text-slate-500">
                    {app.product_name} • {app.total_units} {app.type === 'toxin' ? 'U' : 'ml'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">
                    {new Date(app.application_date).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-slate-400">{app.users?.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
