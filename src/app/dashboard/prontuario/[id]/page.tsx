import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import MedicalInfo from './medical-info'
import EvolutionTimeline from './evolution-timeline'
import NewEvolutionButton from './new-evolution-button'

export default async function ProntuarioPatientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id, id, name').eq('id', user!.id).single()

  // Buscar paciente
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!patient) notFound()

  // Buscar ou criar prontuario
  let { data: medicalRecord } = await supabase
    .from('medical_records')
    .select('*')
    .eq('patient_id', params.id)
    .single()

  if (!medicalRecord) {
    const { data: newRecord } = await supabase
      .from('medical_records')
      .insert({
        clinic_id: userData?.clinic_id,
        patient_id: params.id,
      })
      .select()
      .single()
    medicalRecord = newRecord
  }

  // Buscar evolucoes
  const { data: evolutions } = await supabase
    .from('evolutions')
    .select('*, users(name)')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false })

  // Gera signed URLs (1h) pras fotos da timeline. As evolutions guardam
  // apenas paths (ex: <clinic_id>/<patient_id>/<file>) — sem signed URL,
  // o <img src> nao consegue acessar o bucket privado.
  const allPhotoPaths = Array.from(
    new Set(
      ((evolutions ?? []) as Array<{ photos?: string[] | null }>)
        .flatMap((e) => e.photos ?? [])
        .filter((p): p is string => !!p),
    ),
  )
  const photoUrls: Record<string, string> = {}
  if (allPhotoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('medical-attachments')
      .createSignedUrls(allPhotoPaths, 60 * 60)
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) photoUrls[item.path] = item.signedUrl
    }
  }

  // Buscar anamneses
  const { data: anamneses } = await supabase
    .from('anamneses')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false })

  // Calcular idade
  const age = patient.birth_date 
    ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000)
    : null

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <Link href="/dashboard/prontuario" className="hover:text-slate-700">Prontuarios</Link>
        <span>›</span>
        <span className="text-slate-700">{patient.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center">
            <span className="text-brand-700 text-xl font-bold">
              {patient.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Prontuario</p>
            <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-500">
              {age ? `${age} anos` : ''}
              {patient.phone ? ` • ${patient.phone}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/pacientes/${params.id}`}
            className="btn-secondary w-auto px-4 py-2 text-sm"
            title="Abrir cadastro do paciente (dados de contato, etc)"
          >
            Editar cadastro
          </Link>
          <NewEvolutionButton
            patientId={params.id}
            clinicId={userData?.clinic_id}
            professionalId={userData?.id}
            professionalName={userData?.name}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <MedicalInfo medicalRecord={medicalRecord} patientId={params.id} />
          
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Informacoes</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-900">{patient.email || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CPF</span>
                <span className="text-slate-900">{patient.cpf || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nascimento</span>
                <span className="text-slate-900">
                  {patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('pt-BR') : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Fichas de Anamnese */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Anamneses</h2>
              <Link 
                href={`/dashboard/anamnese/enviar?patient=${params.id}`}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                + Enviar
              </Link>
            </div>
            {(!anamneses || anamneses.length === 0) ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhuma ficha enviada</p>
            ) : (
              <div className="space-y-2">
                {anamneses.map((a: any) => (
                  <Link 
                    key={a.id} 
                    href={`/dashboard/anamnese/${a.id}`}
                    className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">
                        {new Date(a.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        a.status === 'completed' 
                          ? 'bg-emerald-100 text-emerald-700'
                          : a.status === 'viewed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {a.status === 'completed' ? 'Preenchido' : a.status === 'viewed' ? 'Visto' : 'Pendente'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Timeline de Evolucoes</h2>
              <span className="text-xs text-slate-400">{evolutions?.length || 0} registros</span>
            </div>
            <EvolutionTimeline evolutions={evolutions || []} photoUrls={photoUrls} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/dashboard/prontuario" className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar para prontuarios
        </Link>
      </div>
    </div>
  )
}
