import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name, email, role, clinicId, password } = await request.json()

    // Validar dados
    if (!name || !email || !role || !clinicId || !password) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
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
      // Usuário já existe no Auth - atualizar senha e usar o ID dele
      userId = existingAuthUser.id
      
      // Atualizar senha do usuário existente
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true
      })
    } else {
      // Criar novo usuário no Auth com a senha definida pelo admin
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
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
      active: true,
    })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Membro ${name} cadastrado com sucesso!` })

  } catch (error: any) {
    console.error('Erro no convite:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
