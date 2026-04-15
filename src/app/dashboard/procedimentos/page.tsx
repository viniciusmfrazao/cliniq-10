import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ProcedureForm from './procedure-form'
import ProcedureList from './procedure-list'

export default async function ProcedimentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('clinic_id, role').eq('id', user!.id).single()

  const { data: procedures } = await supabase
    .from('procedures')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const isAdmin = userData?.role === 'admin'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Procedimentos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Catalogo de servicos da clinica</p>
      </div>

      {isAdmin && (
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Adicionar procedimento</h2>
          <ProcedureForm clinicId={userData?.clinic_id} />
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">
          Procedimentos cadastrados ({procedures?.length || 0})
        </h2>
        <ProcedureList procedures={procedures || []} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
