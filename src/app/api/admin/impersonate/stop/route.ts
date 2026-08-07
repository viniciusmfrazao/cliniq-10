import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Volta da sessão impersonada pra sessão original do super admin, usando o
// mesmo truque de magic link + verifyOtp. Não exige estar logado como o
// usuário impersonado (o cookie clinike-impersonating já prova que uma
// impersonação estava ativa e guarda o email de quem iniciou).
export async function POST(request: NextRequest) {
  const raw = request.cookies.get('clinike-impersonating')?.value
  if (!raw) {
    return NextResponse.json({ error: 'Nenhuma impersonação ativa' }, { status: 400 })
  }

  let superAdminEmail: string
  try {
    superAdminEmail = JSON.parse(raw).superAdminEmail
  } catch {
    return NextResponse.json({ error: 'Cookie de impersonação inválido' }, { status: 400 })
  }
  if (!superAdminEmail) {
    return NextResponse.json({ error: 'Cookie de impersonação inválido' }, { status: 400 })
  }

  const svc = createServiceClient()
  const supabase = await createClient()

  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: superAdminEmail,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[impersonate/stop] erro ao gerar link', linkErr?.message)
    return NextResponse.json({ error: 'Falha ao restaurar sessão do admin' }, { status: 500 })
  }

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: linkData.properties.hashed_token,
  })
  if (verifyErr) {
    console.error('[impersonate/stop] erro ao trocar sessão', verifyErr.message)
    return NextResponse.json({ error: 'Falha ao restaurar sessão do admin' }, { status: 500 })
  }

  // Fecha quaisquer logs em aberto pra esse admin
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id) {
    await svc
      .from('admin_impersonation_log')
      .update({ ended_at: new Date().toISOString() })
      .eq('super_admin_id', user.id)
      .is('ended_at', null)
  }

  const response = NextResponse.json({ ok: true })
  const cookieStore = await cookies()
  cookieStore.set('clinike-impersonating', '', { path: '/', maxAge: 0 })
  return response
}
