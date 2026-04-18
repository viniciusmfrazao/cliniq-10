import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, price_monthly, price_yearly, max_professionals, modules } = body

    if (!name || price_monthly === undefined || !modules || modules.length === 0) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('admin_plans')
      .insert({
        name,
        description: description || null,
        price_monthly,
        price_yearly: price_yearly || null,
        max_professionals: max_professionals || null,
        modules,
        active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating plan:', error)
      return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 })
    }

    return NextResponse.json(data)
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
      .from('admin_plans')
      .select('*')
      .order('price_monthly', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
