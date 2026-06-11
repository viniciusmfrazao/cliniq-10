import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { sanitizeSearchTerm } from '@/lib/search'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const clinic_id = searchParams.get('clinic_id')
    const action = searchParams.get('action')
    const entity_type = searchParams.get('entity_type')
    const search = searchParams.get('search')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')

    const supabase = createServiceClient()

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        clinics:clinic_id(name),
        users:user_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(500)

    if (clinic_id) {
      query = query.eq('clinic_id', clinic_id)
    }

    // Sanitiza tudo que vai pra .ilike()/.or() do PostgREST. Sem isso,
    // caracteres como `,` `(` `)` `*` `%` `_` `\` `'` `"` quebram a
    // query ou permitem injetar cláusulas adicionais.
    const safeAction = sanitizeSearchTerm(action)
    if (safeAction) {
      query = query.ilike('action', `%${safeAction}%`)
    }

    if (entity_type) {
      query = query.eq('entity_type', entity_type)
    }

    const safeSearch = sanitizeSearchTerm(search)
    if (safeSearch) {
      query = query.or(
        `action.ilike.%${safeSearch}%,entity_name.ilike.%${safeSearch}%,entity_type.ilike.%${safeSearch}%`,
      )
    }

    if (date_from) {
      query = query.gte('created_at', `${date_from}T00:00:00`)
    }

    if (date_to) {
      query = query.lte('created_at', `${date_to}T23:59:59`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching logs:', error)
      return NextResponse.json({ error: 'Erro ao buscar logs' }, { status: 500 })
    }

    // Format the data to include clinic and user names
    const formattedData = data?.map(log => ({
      ...log,
      clinic_name: log.clinics?.name || null,
      user_name: log.users?.name || null,
      clinics: undefined,
      users: undefined,
    })) || []

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
