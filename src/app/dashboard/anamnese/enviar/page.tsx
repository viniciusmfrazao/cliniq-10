import { createClient, getCachedUser } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import SendAnamneseForm from './send-form'

export default async function EnviarAnamesePage({ searchParams }: { searchParams: { patient?: string } }) {
  const supabase = await createClient()
  const user = await getCachedUser()
  
  if (!user) redirect('/login')
  
  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, clinics(name)')
    .eq('id', user.id)
    .single()
  
  if (!userData?.clinic_id) redirect('/login')
  
  const patients = await getAllPatients<{ id: string; name: string; email: string | null; phone: string | null; cpf: string | null }>(
    supabase,
    userData.clinic_id,
    'id, name, email, phone, cpf'
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/anamnese" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enviar Anamnese</h1>
          <p className="text-slate-500 dark:text-slate-400">Gere um link de ficha de anamnese para o paciente preencher</p>
        </div>
      </div>

      <SendAnamneseForm 
        clinicId={userData.clinic_id}
        clinicName={(userData.clinics as any)?.name || 'Clínica'}
        patients={patients || []}
        userId={user.id}
        preSelectedPatient={searchParams.patient}
      />
    </div>
  )
}
