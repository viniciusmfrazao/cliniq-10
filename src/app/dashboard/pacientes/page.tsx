import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import PatientSearch from './patient-search'
import { sanitizeSearchTerm } from '@/lib/search'

const PER_PAGE = 50

export default async function PacientesPage({ 
  searchParams 
}: { 
  searchParams: { q?: string; filter?: string; page?: string }
}) {
  const sp = searchParams
  const safeQuery = sanitizeSearchTerm(sp.q)
  const filter = sp.filter
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user.id).maybeSingle()

  const currentPage = Math.max(1, parseInt(sp.page || '1'))
  const offset = (currentPage - 1) * PER_PAGE

  // Contar totais em paralelo
  const [totalResult, pendingResult] = await Promise.all([
    supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', userData?.clinic_id),
    supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', userData?.clinic_id)
      .or('cpf.is.null,birth_date.is.null')
  ])

  const totalPatients = totalResult.count || 0
  const totalPending = pendingResult.count || 0

  // Query para listar pacientes
  let query = supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('name', { ascending: true })

  // Aplicar filtro de busca
  if (safeQuery) {
    query = query.or(`name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,cpf.ilike.%${safeQuery}%`)
  }

  // Aplicar filtro de pendentes
  if (filter === 'pendentes') {
    query = query.or('cpf.is.null,birth_date.is.null')
  }

  // Contar para paginação (com filtros aplicados)
  const activeTotal = filter === 'pendentes' ? totalPending : totalPatients
  const totalPages = Math.ceil(activeTotal / PER_PAGE)

  // Aplicar paginação
  query = query.range(offset, offset + PER_PAGE - 1)

  const { data: patients } = await query

  // Para o alerta, verificar se há pendentes na página atual
  const incompleteInPage = patients?.filter(p => !p.cpf || !p.birth_date) || []

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{totalPatients || 0} cadastrados</p>
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
      {totalPending > 0 && !filter && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
              <Icon name="bell" className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                {totalPending} cadastro{totalPending > 1 ? 's' : ''} pendente{totalPending > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-amber-700">
                Pacientes sem CPF ou data de nascimento - use o filtro "Pendentes" para ver
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 mb-4">
        <PatientSearch initialQuery={safeQuery} clinicId={userData?.clinic_id || ''} />
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-2 mb-4">
        <Link
          href="/dashboard/pacientes"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !filter
              ? 'bg-violet-100 text-violet-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos ({totalPatients || 0})
        </Link>
        <Link
          href="/dashboard/pacientes?filter=pendentes"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            filter === 'pendentes'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Pendentes ({totalPending})
        </Link>
      </div>

      <div className="card divide-y divide-slate-100">
        {patients?.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icon name="users" className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">
              {filter === 'pendentes' 
                ? 'Todos os cadastros estão completos!' 
                : 'Nenhum paciente encontrado'}
            </p>
            {!filter && (
              <Link href="/dashboard/pacientes/novo" className="text-sm text-violet-600 font-medium mt-2 inline-block">
                Cadastrar primeiro paciente
              </Link>
            )}
          </div>
        ) : (
          patients?.map(patient => {
            const isIncomplete = !patient.cpf || !patient.birth_date
            return (
              <Link 
                key={patient.id} 
                href={`/dashboard/pacientes/${patient.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-11 h-11 bg-gradient-to-br from-violet-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {/* photo_url: se for URL externa (http/https) renderiza; se for path
                        de bucket privado (sem signed URL) renderiza fallback. Bucket de
                        foto de perfil ainda não existe, então hoje quase sempre cai no fallback. */}
                    {patient.photo_url && /^https?:\/\//.test(patient.photo_url) ? (
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
                      {new Date().getFullYear() - Number(patient.birth_date.slice(0, 4))} anos
                    </span>
                  )}
                  <Icon name="chevronRight" className="w-4 h-4 text-slate-300" />
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-slate-500">
            Mostrando {offset + 1}-{Math.min(offset + PER_PAGE, activeTotal)} de {activeTotal}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/dashboard/pacientes?page=${currentPage - 1}${safeQuery ? `&q=${encodeURIComponent(safeQuery)}` : ''}${filter ? `&filter=${filter}` : ''}`}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                <Icon name="chevronLeft" className="w-4 h-4" />
                Anterior
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-slate-600">
              Página {currentPage} de {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                href={`/dashboard/pacientes?page=${currentPage + 1}${safeQuery ? `&q=${encodeURIComponent(safeQuery)}` : ''}${filter ? `&filter=${filter}` : ''}`}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                Próxima
                <Icon name="chevronRight" className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
