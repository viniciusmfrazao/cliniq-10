import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ApplicationHistory from './application-history'
import NewApplicationButton from './new-application-button'

export default async function PatientInjetaveisPage({ params }: { params: { patientId: string } }) {
  const { patientId } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id, id, name').eq('id', user!.id).maybeSingle()

  // Buscar paciente
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .maybeSingle()

  if (!patient) notFound()

  // Buscar aplicacoes com pontos
  const { data: applications } = await supabase
    .from('injectable_applications')
    .select('*, users(name), injectable_points(*)')
    .eq('patient_id', patientId)
    .order('application_date', { ascending: false })

  // Calcular estatisticas
  const toxinApps = applications?.filter(a => a.type === 'toxin') || []
  const fillerApps = applications?.filter(a => a.type === 'filler') || []
  const totalUnits = toxinApps.reduce((sum, a) => sum + (a.total_units || 0), 0)

  // Ultima aplicacao
  const lastApp = applications?.[0]
  const daysSinceLastApp = lastApp 
    ? Math.floor((Date.now() - new Date(lastApp.application_date).getTime()) / 86400000)
    : null

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
            <span className="text-purple-700 font-bold text-2xl">
              {patient.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-500">{patient.phone || patient.email}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link 
            href={`/dashboard/pacientes/${patientId}?tab=evolucoes`}
            className="btn-secondary w-auto px-4 py-2.5"
          >
            Ver prontuario
          </Link>
          {/* Suspense é obrigatório no Next 15 pq o componente usa useSearchParams */}
          <Suspense fallback={null}>
            <NewApplicationButton
              patientId={patientId}
              clinicId={userData?.clinic_id}
              professionalId={userData?.id}
              professionalName={userData?.name}
              patientGender={patient.gender === 'M' ? 'male' : 'female'}
            />
          </Suspense>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-lg">💉</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{toxinApps.length}</p>
              <p className="text-xs text-slate-500">Sessoes de toxina</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
              <span className="text-lg">✨</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{fillerApps.length}</p>
              <p className="text-xs text-slate-500">Sessoes de preenchedor</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalUnits}</p>
              <p className="text-xs text-slate-500">Unidades totais</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <span className="text-lg">📅</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {daysSinceLastApp !== null ? daysSinceLastApp : '-'}
              </p>
              <p className="text-xs text-slate-500">Dias desde ultima</p>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <ApplicationHistory applications={applications || []} patientId={patientId} patientGender={patient.gender === 'M' ? 'male' : 'female'} />

      <div className="mt-8">
        <Link href="/dashboard/injetaveis" className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar para injetaveis
        </Link>
      </div>
    </div>
  )
}
