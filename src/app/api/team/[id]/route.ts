import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE - Remover membro da equipe (inclui auth.users)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const memberId = params.id
    const { clinicId } = await request.json()

    if (!memberId || !clinicId) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Cliente com service role para operações admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar se quem está chamando é admin da clínica
    const serverClient = await createServerClient()
    const { data: { user: currentUser } } = await serverClient.auth.getUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: adminCheck } = await serverClient
      .from('users')
      .select('role, clinic_id')
      .eq('id', currentUser.id)
      .single()

    if (!adminCheck || adminCheck.role !== 'admin' || adminCheck.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verificar se o membro pertence à clínica e não é admin
    const { data: memberToDelete } = await supabaseAdmin
      .from('users')
      .select('id, role, clinic_id')
      .eq('id', memberId)
      .eq('clinic_id', clinicId)
      .single()

    if (!memberToDelete) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    if (memberToDelete.role === 'admin') {
      return NextResponse.json({ error: 'Não é possível remover administradores' }, { status: 400 })
    }

    // 1. Deletar da tabela public.users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', memberId)
      .eq('clinic_id', clinicId)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // 2. Deletar da tabela auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(memberId)

    if (authError) {
      console.error('Erro ao deletar auth user (pode já ter sido removido):', authError.message)
    }

    return NextResponse.json({ success: true, message: 'Membro removido com sucesso' })

  } catch (error: any) {
    console.error('Erro ao remover membro:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
