import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import PatientSearch from './patient-search'

export default async function PacientesPage({ 
  searchParams 
}: { 
  searchParams: { q?: string; filter?: string } 
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

  let query = supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('created_at', { ascending: false })

  if (searchParams.q) {
    query = query.or(`name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%,cpf.ilike.%${searchParams.q}%`)
  }

  const { data: patients } = await query.limit(100)

  // Separar pacientes completos e incompletos
  const incompletePatients = patients?.filter(p => !p.cpf || !p.birth_date) || []
  const completePatients = patients?.filter(p => p.cpf && p.birth_date) || []

  // Filtrar baseado no parâmetro
  const filteredPatients = searchParams.filter === 'pendentes' 
    ? incompletePatients 
    : patients

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{patients?.length || 0} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/pacientes/importar" className="btn-secondary w-auto px-4 flex items-center gap-2">
            <Icon name="upload" className="w-4 h-4" />
            Importar
          </Link>
          <Link href="/dashboard/pacientes/novo" className="btn-primary w-auto px-4 flex items-center gap-2">
            <Icon name="plus" className="w-4 h-4" />
            Novo paciente
          </Link>
        </div>
      </div>

      {/* Alerta de cadastros pendentes */}
      {incompletePatients.length > 0 && !searchParams.filter && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
              <Icon name="bell" className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                {incompletePatients.length} cadastro{incompletePatients.length > 1 ? 's' : ''} pendente{incompletePatients.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-amber-700">
                Pacientes sem CPF ou data de nascimento - use o filtro "Pendentes" para ver
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 mb-4">
        <PatientSearch initialQuery={searchParams.q || ''} clinicId={userData?.clinic_id || ''} />
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-2 mb-4">
        <Link
          href="/dashboard/pacientes"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !searchParams.filter
              ? 'bg-violet-100 text-violet-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos ({patients?.length || 0})
        </Link>
        <Link
          href="/dashboard/pacientes?filter=pendentes"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            searchParams.filter === 'pendentes'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Pendentes ({incompletePatients.length})
        </Link>
      </div>

      <div className="card divide-y divide-slate-100">
        {filteredPatients?.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icon name="users" className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">
              {searchParams.filter === 'pendentes' 
                ? 'Todos os cadastros estão completos!' 
                : 'Nenhum paciente encontrado'}
            </p>
            {!searchParams.filter && (
              <Link href="/dashboard/pacientes/novo" className="text-sm text-violet-600 font-medium mt-2 inline-block">
                Cadastrar primeiro paciente
              </Link>
            )}
          </div>
        ) : (
          filteredPatients?.map(patient => {
            const isIncomplete = !patient.cpf || !patient.birth_date
            return (
              <Link 
                key={patient.id} 
                href={`/dashboard/pacientes/${patient.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-11 h-11 bg-gradient-to-br from-violet-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0">
                    {patient.photo_url ? (
                      <img src={patient.photo_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {patient.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Indicador de incompleto */}
                  {isIncomplete && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                      <Icon name="bell" className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{patient.name}</p>
                    {isIncomplete && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Completar
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {patient.phone || patient.email || 'Sem contato'}
                    {patient.cpf && ` • CPF: ${patient.cpf}`}
                  </p>
                </div>

                {/* Tags ou info adicional */}
                <div className="flex items-center gap-2">
                  {patient.birth_date && (
                    <span className="text-xs text-slate-400">
                      {new Date().getFullYear() - new Date(patient.birth_date).getFullYear()} anos
                    </span>
                  )}
                  <Icon name="chevronRight" className="w-4 h-4 text-slate-300" />
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
