import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PatientForm from '../../patient-form'

export default async function EditarPacientePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!patient) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Editar paciente</h1>
        <p className="text-sm text-slate-500 mt-0.5">{patient.name}</p>
      </div>
      <div className="card p-6">
        <PatientForm patient={{
          ...patient,
          birth_date: patient.birth_date || '',
          tags: patient.tags || [],
        }} />
      </div>
    </div>
  )
}
