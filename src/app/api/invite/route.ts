import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { FACTORY_DEFAULTS } from '@/lib/permissions'

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

    const isAdmin = adminCheck?.role === 'admin' || adminCheck?.role === 'super_admin'
    if (!adminCheck || !isAdmin || adminCheck.clinic_id !== clinicId) {
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

    // Verificar se usuário já existe no Auth.
    //
    // IMPORTANTE: antes a gente *resetava a senha* do usuário Auth pré-existente
    // pra reaproveitar o mesmo `id`. Isso era um vetor de takeover entre
    // clínicas: o admin de uma clínica conseguia trocar a senha de qualquer
    // pessoa cuja conta já existisse no Supabase Auth.
    //
    // Como o schema atual usa `users.id = auth.users.id` (PK 1:1), o mesmo
    // auth user *não pode* fazer parte de duas clínicas — seria conflito de PK.
    // Então: se o e-mail já tem conta no Auth, recusamos o convite e pedimos
    // outro e-mail. Quando virmos multi-clínica (clinic_memberships), isso
    // muda.
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users?.find(u => u.email === email)

    if (existingAuthUser) {
      return NextResponse.json(
        {
          error:
            'Já existe uma conta com este e-mail no sistema. Use outro e-mail ou peça para o titular acessar com a senha dele.',
        },
        { status: 409 },
      )
    }

    // Criar novo usuário no Auth com a senha definida pelo admin
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { invited: true }
    })

    // Caso raro: a listUsers() é paginada (default 50). Se o e-mail estiver
    // numa página posterior, cai aqui no createUser com erro de duplicado.
    // Tratamos como o mesmo 409 acima.
    if (createError) {
      const msg = (createError.message || '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('user already')) {
        return NextResponse.json(
          {
            error:
              'Já existe uma conta com este e-mail no sistema. Use outro e-mail ou peça para o titular acessar com a senha dele.',
          },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: createError.message || 'Erro ao criar usuário' }, { status: 500 })
    }
    if (!newUser?.user) {
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
    }

    const userId = newUser.user.id

    // Aplica permissoes do papel — primeiro tenta defaults customizadas
    // pela clinica em clinic_role_defaults; se nao tiver, usa factory.
    // admin/super_admin sempre recebem 'all'.
    let inheritedPermissions: string[] | null = null
    if (role !== 'admin' && role !== 'super_admin') {
      const { data: roleDefault } = await supabaseAdmin
        .from('clinic_role_defaults')
        .select('permissions')
        .eq('clinic_id', clinicId)
        .eq('role', role)
        .maybeSingle()

      if (roleDefault?.permissions && Array.isArray(roleDefault.permissions)) {
        inheritedPermissions = roleDefault.permissions as string[]
      } else {
        inheritedPermissions = (FACTORY_DEFAULTS as Record<string, string[]>)[role] ?? []
      }
    } else {
      inheritedPermissions = ['all']
    }

    // Inserir na tabela users
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: userId,
      clinic_id: clinicId,
      name,
      email,
      role,
      active: true,
      permissions: inheritedPermissions,
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
