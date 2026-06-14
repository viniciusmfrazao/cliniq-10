import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin', 'manager', 'financial'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const clinicId = userData?.clinic_id
  const url = new URL(req.url)
  const dataInicio = url.searchParams.get('data_inicio')
  const dataFim = url.searchParams.get('data_fim')

  let query = supabase
    .from('entradas')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('data_venda', { ascending: false })

  if (dataInicio) query = query.gte('data_venda', dataInicio)
  if (dataFim) query = query.lte('data_venda', dataFim)

  // Sem filtro de data: últimos 90 dias por padrão
  if (!dataInicio && !dataFim) {
    const noventa = new Date()
    noventa.setDate(noventa.getDate() - 90)
    query = query.gte('data_venda', noventa.toISOString().slice(0, 10))
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
