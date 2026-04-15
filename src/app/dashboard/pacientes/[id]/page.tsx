import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DeletePatientButton from './delete-button'

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!patient) notFound()

  // Buscar historico de consultas
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, procedures(name), users(name)')
    .eq('patient_id', params.id)
    .order('start_time', { ascending: false })
    .limit(10)

  const age = patient.birth_date 
    ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000)
    : null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center">
            {patient.photo_url ? (
              <img src={patient.photo_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <span className="text-brand-700 text-2xl font-bold">
                {patient.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-500">
              {age ? `${age} anos` : ''} 
              {patient.gender === 'F' ? ' • Feminino' : patient.gender === 'M' ? ' • Masculino' : ''}
            </p>
            {patient.tags?.length > 0 && (
              <div className="flex gap-1 mt-2">
                {patient.tags.map((tag: string) => (
                  <span key={tag} className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/pacientes/${params.id}/editar`} className="btn-secondary w-auto px-4 py-2 text-sm">
            Editar
          </Link>
          <DeletePatientButton patientId={params.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Contato</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Telefone</p>
              <p className="text-sm text-slate-900">{patient.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-sm text-slate-900">{patient.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">CPF</p>
              <p className="text-sm text-slate-900">{patient.cpf || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Endereco</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Endereco</p>
              <p className="text-sm text-slate-900">{patient.address || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Cidade/Estado</p>
              <p className="text-sm text-slate-900">
                {patient.city || '-'}{patient.state ? ` / ${patient.state}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">CEP</p>
              <p className="text-sm text-slate-900">{patient.zip_code || '-'}</p>
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="card p-5 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Observacoes</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}

        <div className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Historico de consultas</h2>
            <Link 
              href={`/dashboard/agenda?patient=${params.id}`} 
              className="text-xs text-brand-600 font-medium"
            >
              Agendar consulta
            </Link>
          </div>
          
          {appointments?.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhuma consulta registrada</p>
          ) : (
            <div className="space-y-2">
              {appointments?.map(apt => (
                <div key={apt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {apt.procedures?.name || 'Consulta'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(apt.start_time).toLocaleDateString('pt-BR')} as {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {apt.users?.name ? ` • ${apt.users.name}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                    apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    apt.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {apt.status === 'completed' ? 'Realizada' :
                     apt.status === 'cancelled' ? 'Cancelada' :
                     apt.status === 'confirmed' ? 'Confirmada' :
                     apt.status === 'no_show' ? 'Faltou' :
                     'Agendada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Link href="/dashboard/pacientes" className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar para lista
        </Link>
      </div>
    </div>
  )
}
