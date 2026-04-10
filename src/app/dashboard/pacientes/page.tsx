import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PatientSearch from './patient-search'

export default async function PacientesPage({ 
  searchParams 
}: { 
  searchParams: { q?: string } 
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id').eq('id', user!.id).single()

  let query = supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  if (searchParams.q) {
    query = query.or(`name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`)
  }

  const { data: patients } = await query.limit(50)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{patients?.length || 0} cadastrados</p>
        </div>
        <Link href="/dashboard/pacientes/novo" className="btn-primary w-auto px-4">
          + Novo paciente
        </Link>
      </div>

      <div className="card p-4 mb-4">
        <PatientSearch initialQuery={searchParams.q || ''} />
      </div>

      <div className="card divide-y divide-slate-100">
        {patients?.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-sm text-slate-500">Nenhum paciente encontrado</p>
            <Link href="/dashboard/pacientes/novo" className="text-sm text-brand-600 font-medium mt-2 inline-block">
              Cadastrar primeiro paciente
            </Link>
          </div>
        ) : (
          patients?.map(patient => (
            <Link 
              key={patient.id} 
              href={`/dashboard/pacientes/${patient.id}`}
              className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                {patient.photo_url ? (
                  <img src={patient.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="text-brand-700 font-semibold">
                    {patient.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{patient.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {patient.phone || patient.email || 'Sem contato'}
                </p>
              </div>
              {patient.tags?.length > 0 && (
                <div className="flex gap-1">
                  {patient.tags.slice(0, 2).map((tag: string) => (
                    <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
