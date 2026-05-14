import BackButton from '@/components/ui/BackButton'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PatientForm from '../../patient-form'

export default async function EditarPacientePage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!patient) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton href="/dashboard/pacientes" label="Pacientes" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Editar paciente</h1>
        <p className="text-sm text-slate-500 mt-0.5">{patient.name}</p>
      </div>
      <div className="card p-6">
        <PatientForm patient={{
          id: patient.id,
          name: patient.name || '',
          email: patient.email || '',
          phone: patient.phone || '',
          cpf: patient.cpf || '',
          birth_date: patient.birth_date || '',
          gender: patient.gender || '',
          address: patient.address || '',
          city: patient.city || '',
          state: patient.state || '',
          zip_code: patient.zip_code || '',
          notes: patient.notes || '',
          tags: patient.tags || [],
        }} />
      </div>
    </div>
  )
}
