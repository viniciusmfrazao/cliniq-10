import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProcedureList from './procedure-list'
import ProcedureForm from './procedure-form'

export const metadata = {
  title: 'Procedimentos | Clinike',
}

const PROFESSIONAL_ROLES = ['doctor', 'biomedic', 'nurse', 'esthetician', 'physiotherapist', 'nutritionist', 'psychologist', 'dentist']

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

  const [proceduresResult, professionalsResult] = await Promise.all([
    supabase
      .from('procedures')
      .select('*')
      .eq('clinic_id', userData.clinic_id)
      .order('category', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('users')
      .select('id, name, role, professional_role, active')
      .eq('clinic_id', userData.clinic_id)
      .order('name'),
  ])

  const procedures = proceduresResult.data || []
  const professionals = (professionalsResult.data || []).filter(
    (u: any) => (PROFESSIONAL_ROLES.includes(u.role) || PROFESSIONAL_ROLES.includes(u.professional_role)) && u.active !== false
  )

  const isAdmin = userData.role === 'admin' || userData.role === 'super_admin'

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
            Procedimentos
          </h1>
          <p className="text-sm text-slate-500">
            Gerencie os procedimentos da clínica e quem realiza cada um
          </p>
        </div>
        <a
          href="/dashboard/procedimentos/disponibilidade"
          className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium rounded-xl border border-amber-200 transition-colors flex-shrink-0"
        >
          <span>📅</span>
          Dias Lavieen / Hipro
        </a>
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Adicionar procedimento
          </h2>
          <ProcedureForm clinicId={userData.clinic_id} professionals={professionals} />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Procedimentos cadastrados
        </h2>
        <ProcedureList
          procedures={procedures as any}
          professionals={professionals}
          clinicId={userData.clinic_id}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}

