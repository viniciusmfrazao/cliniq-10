import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Verificar se clínica tem o módulo ia_prontuario ativo
  const { data: clinicUser } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('auth_id', session.user.id)
    .single()

  if (clinicUser?.clinic_id) {
    const { data: clinic } = await supabase
      .from('clinics')
      .select('settings')
      .eq('id', clinicUser.clinic_id)
      .single()

    const activeModules: string[] = clinic?.settings?.active_modules ?? []
    if (!activeModules.includes('ia_prontuario')) {
      return NextResponse.json({ error: 'Módulo IA Prontuário não está ativo para esta clínica' }, { status: 403 })
    }
  }

  // Chamar edge function que já tem ANTHROPIC_API_KEY
  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-prontuario`
  const resp = await fetch(edgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await resp.json()
  return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
}
