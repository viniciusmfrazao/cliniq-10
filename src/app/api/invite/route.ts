import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name, email, role, clinicId } = await request.json()

    // Validar dados
    if (!name || !email || !role || !clinicId) {
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

    // Verificar se usuário já existe na clínica
    const { data: existingInClinic } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('clinic_id', clinicId)
      .single()

    if (existingInClinic) {
      return NextResponse.json({ error: 'Este usuário já faz parte da equipe' }, { status: 400 })
    }

    // Verificar se usuário já existe no Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existingAuthUser) {
      // Usuário já existe no Auth - usar o ID dele
      userId = existingAuthUser.id
    } else {
      // Criar novo usuário no Auth
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { invited: true }
      })

      if (createError || !newUser.user) {
        return NextResponse.json({ error: createError?.message || 'Erro ao criar usuário' }, { status: 500 })
      }

      userId = newUser.user.id
    }

    // Inserir na tabela users
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: userId,
      clinic_id: clinicId,
      name,
      email,
      role,
    })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Enviar email de reset de senha
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (resetError) {
      console.error('Erro ao gerar link de recuperação:', resetError)
    }

    return NextResponse.json({ success: true, message: `Convite enviado para ${email}` })

  } catch (error: any) {
    console.error('Erro no convite:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
