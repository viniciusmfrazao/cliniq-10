import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import PermissionsForm from './permissions-form'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function MemberPermissionsPage({ params }: PageProps) {
  const { id: memberId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentUser } = await supabase
    .from('users')
    .select('role, clinic_id')
    .eq('id', user.id)
    .single()

  if (currentUser?.role !== 'admin') {
    redirect('/dashboard/equipe')
  }

  const { data: member } = await supabase
    .from('users')
    .select('id, name, email, role, permissions, active, clinic_id')
    .eq('id', memberId)
    .single()

  if (!member || member.clinic_id !== currentUser.clinic_id) {
    notFound()
  }

  if (member.id === user.id) {
    redirect('/dashboard/equipe')
  }

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <div className="mb-6">
        <Link
          href="/dashboard/equipe"
          className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar pra equipe
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Permissões</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Defina o que <span className="font-medium text-slate-700">{member.name}</span> pode
          acessar no sistema
        </p>
      </div>

      <PermissionsForm
        member={{
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          permissions: member.permissions ?? undefined,
        }}
      />
    </div>
  )
}
