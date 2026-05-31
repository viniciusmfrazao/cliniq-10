import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE - Desativar membro da equipe (soft delete para manter histórico)
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

    const isAdmin = adminCheck?.role === 'admin' || adminCheck?.role === 'super_admin'
    if (!adminCheck || !isAdmin || adminCheck.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verificar se o membro pertence à clínica e não é admin/super_admin
    const { data: memberToDeactivate } = await supabaseAdmin
      .from('users')
      .select('id, name, role, clinic_id')
      .eq('id', memberId)
      .eq('clinic_id', clinicId)
      .single()

    if (!memberToDeactivate) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    if (memberToDeactivate.role === 'admin' || memberToDeactivate.role === 'super_admin') {
      return NextResponse.json({ error: 'Não é possível desativar administradores' }, { status: 400 })
    }

    // 1. SOFT DELETE: Apenas desativar o usuário (mantém histórico)
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ 
        active: false,
        deleted_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .eq('clinic_id', clinicId)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // 2. Desabilitar login no auth (não deleta, apenas bloqueia)
    await supabaseAdmin.auth.admin.updateUserById(memberId, {
      ban_duration: '876000h' // ~100 anos = permanente
    })

    return NextResponse.json({ 
      success: true, 
      message: `${memberToDeactivate.name} foi desativado. O histórico foi mantido.` 
    })

  } catch (error: any) {
    console.error('Erro ao desativar membro:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}

// PATCH - Atualizar professional_role do membro
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: currentUser } = await supabase.from('users').select('role, clinic_id').eq('id', user.id).single()
    if (!['admin', 'super_admin', 'manager'].includes(currentUser?.role || ''))
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { professional_role } = await request.json()

    // Usa service role para o update — o cliente do usuário logado é barrado
    // pela RLS da tabela users e o update falha silenciosamente (afeta 0 linhas
    // sem retornar erro), fazendo o professional_role nunca ser salvo.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabaseAdmin
      .from('users')
      .update({ professional_role: professional_role || null })
      .eq('id', params.id)
      .eq('clinic_id', currentUser!.clinic_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
