import BackButton from '@/components/ui/BackButton'
import PatientForm from '../patient-form'

export default function NovoPacientePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <BackButton href="/dashboard/pacientes" label="Pacientes" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Novo paciente</h1>
        <p className="text-sm text-slate-500 mt-0.5">Preencha os dados do paciente</p>
      </div>
      <div className="card p-6">
        <PatientForm />
      </div>
    </div>
  )
}
