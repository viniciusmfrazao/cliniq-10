import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProcedureList from './procedure-list'
import ProcedureForm from './procedure-form'

export const metadata = {
  title: 'Procedimentos | Cliniq',
}

export default async function ProcedimentosPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!userData?.clinic_id) redirect('/login')

  const { data: procedures } = await supabase
    .from('procedures')
    .select('*')
    .eq('clinic_id', userData.clinic_id)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const isAdmin = userData.role === 'admin'

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
          Procedimentos
        </h1>
        <p className="text-sm text-slate-500">
          Gerencie os procedimentos da clínica
        </p>
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Adicionar procedimento
          </h2>
          <ProcedureForm clinicId={userData.clinic_id} />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Procedimentos cadastrados
        </h2>
        <ProcedureList procedures={procedures || []} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
