import { createClient } from '@/lib/supabase/server'
import { getAllPatients } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import WaitingListTable from './waiting-list-table'

export default async function WaitingListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  // Buscar lista de espera
  const { data: waitingList } = await supabase
    .from('waiting_list')
    .select(`
      *,
      patients(id, name, phone, email),
      procedures(id, name),
      users(id, name)
    `)
    .eq('clinic_id', userData?.clinic_id)
    .in('status', ['aguardando', 'contatado'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  // Contar por status
  const { data: stats } = await supabase
    .from('waiting_list')
    .select('status')
    .eq('clinic_id', userData?.clinic_id)

  const counts = {
    aguardando: stats?.filter(s => s.status === 'aguardando').length || 0,
    contatado: stats?.filter(s => s.status === 'contatado').length || 0,
    agendado: stats?.filter(s => s.status === 'agendado').length || 0,
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lista de Espera</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pacientes aguardando vaga para agendamento</p>
        </div>
        <Link href="/dashboard/lista-espera/novo" className="btn-primary w-full md:w-auto flex items-center justify-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          Adicionar à lista
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Icon name="clock" className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.aguardando}</p>
              <p className="text-xs text-slate-500">Aguardando</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Icon name="phone" className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.contatado}</p>
              <p className="text-xs text-slate-500">Contatados</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Icon name="check" className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.agendado}</p>
              <p className="text-xs text-slate-500">Agendados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <WaitingListTable 
          waitingList={waitingList || []}
          patients={patients || []}
          procedures={procedures || []}
          professionals={professionals || []}
          clinicId={userData?.clinic_id || ''}
        />
      </div>
    </div>
  )
}
