import { createClient } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import { redirect } from 'next/navigation'
import WaitingListForm from './waiting-list-form'

export default async function NovaListaEsperaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  const patients = await getAllPatients<{ id: string; name: string }>(
    supabase,
    userData?.clinic_id,
    'id, name'
  )

  const { data: procedures } = await supabase
    .from('procedures')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .order('name')

  const { data: professionals } = await supabase
    .from('users')
    .select('id, name')
    .eq('clinic_id', userData?.clinic_id)
    .in('role', ['admin', 'doctor', 'esthetician'])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Adicionar à Lista de Espera</h1>
        <p className="text-sm text-slate-500 mt-0.5">Cadastre um paciente que aguarda vaga</p>
      </div>
      <div className="card p-6">
        <WaitingListForm
          clinicId={userData?.clinic_id || ''}
          patients={patients || []}
          procedures={procedures || []}
          professionals={professionals || []}
        />
      </div>
    </div>
  )
}
