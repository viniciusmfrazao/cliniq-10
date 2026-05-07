import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST - Reativar membro da equipe
export async function POST(
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

    const isAdmin = adminCheck?.role === 'admin' || adminCheck?.role === 'super_admin'
    if (!adminCheck || !isAdmin || adminCheck.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verificar se o membro pertence à clínica
    const { data: memberToReactivate } = await supabaseAdmin
      .from('users')
      .select('id, name, clinic_id, active')
      .eq('id', memberId)
      .eq('clinic_id', clinicId)
      .single()

    if (!memberToReactivate) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    if (memberToReactivate.active !== false) {
      return NextResponse.json({ error: 'Membro já está ativo' }, { status: 400 })
    }

    // 1. Reativar o usuário na tabela users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ 
        active: true,
        deleted_at: null
      })
      .eq('id', memberId)
      .eq('clinic_id', clinicId)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // 2. Desbanir no auth
    await supabaseAdmin.auth.admin.updateUserById(memberId, {
      ban_duration: 'none'
    })

    return NextResponse.json({ 
      success: true, 
      message: `${memberToReactivate.name} foi reativado com sucesso!` 
    })

  } catch (error: any) {
    console.error('Erro ao reativar membro:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
