import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, cnpj, slug, planName, adminName, adminEmail, adminPassword, activeModules } = body

    if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if slug already exists
    const { data: existingClinic } = await supabase
      .from('clinics')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingClinic) {
      return NextResponse.json({ error: 'Slug já existe' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
    }

    // 1. Create the clinic
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .insert({
        name,
        cnpj: cnpj || null,
        slug,
        plan: planName || 'starter',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        settings: { active_modules: activeModules || [] }
      })
      .select()
      .single()

    if (clinicError) {
      console.error('Clinic error:', clinicError)
      return NextResponse.json({ error: 'Erro ao criar clínica' }, { status: 500 })
    }

    // 2. Create auth user using service role
    const serviceSupabase = createServiceClient()
    
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    })

    if (authError) {
      // Rollback clinic
      await supabase.from('clinics').delete().eq('id', clinic.id)
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
    }

    // 3. Create user record
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        clinic_id: clinic.id,
        name: adminName,
        email: adminEmail,
        role: 'admin'
      })

    if (userError) {
      // Rollback
      await supabase.from('clinics').delete().eq('id', clinic.id)
      console.error('User error:', userError)
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('clinics')
      .select(`
        *,
        users:users(count),
        patients:patients(count)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar clínicas' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
