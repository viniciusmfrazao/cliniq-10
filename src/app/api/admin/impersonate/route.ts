import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

// Permite que um super_admin "entre" na conta de um usuário de qualquer
// clínica pra testar/depurar (ex: emissão de nota fiscal). Usa o truque
// padrão do Supabase: gera um magic link pro usuário alvo e valida o token
// (verifyOtp) direto na sessão da request — isso troca o cookie de auth
// pro usuário alvo de verdade, então RLS, permissões e tudo mais funcionam
// exatamente como se fosse aquele usuário logado. Não existe "modo fake":
// ou é uma sessão real, ou RLS bloqueia os dados da clínica.
export async function POST(request: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user: superAdminUser } } = await supabase.auth.getUser()
  if (!superAdminUser?.email) {
    return NextResponse.json({ error: 'Sessão de super admin inválida' }, { status: 401 })
  }

  const svc = createServiceClient()

  const { data: targetUser, error: targetErr } = await svc
    .from('users')
    .select('id, email, name, clinic_id, active, clinics(name)')
    .eq('id', userId)
    .maybeSingle()

  if (targetErr || !targetUser || !targetUser.email) {
    return NextResponse.json({ error: 'Usuário alvo não encontrado' }, { status: 404 })
  }
  if (!targetUser.active) {
    return NextResponse.json({ error: 'Usuário alvo está inativo' }, { status: 400 })
  }

  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[impersonate] erro ao gerar link', linkErr?.message)
    return NextResponse.json({ error: 'Falha ao gerar sessão do usuário alvo' }, { status: 500 })
  }

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: linkData.properties.hashed_token,
  })
  if (verifyErr) {
    console.error('[impersonate] erro ao trocar sessão', verifyErr.message)
    return NextResponse.json({ error: 'Falha ao entrar na conta do usuário' }, { status: 500 })
  }

  const clinicName = (targetUser as any).clinics?.name || 'Clínica'
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  await svc.from('admin_impersonation_log').insert({
    super_admin_id: superAdminUser.id,
    super_admin_email: superAdminUser.email,
    target_user_id: targetUser.id,
    target_user_email: targetUser.email,
    target_clinic_id: targetUser.clinic_id,
    target_clinic_name: clinicName,
    ip,
  })

  const response = NextResponse.json({ ok: true })
  // Usa o mesmo mecanismo (next/headers cookies()) que o supabase ssr usa
  // pra gravar os cookies de sessão logo acima — criar um NextResponse
  // separado e chamar .cookies.set() nele é uma segunda via de escrita de
  // Set-Cookie que pode não se combinar com a primeira dependendo do
  // runtime, deixando esse cookie de fora da resposta final (foi o que
  // causou o super admin ficar preso na conta impersonada sem o botão
  // "Voltar pro admin").
  const cookieStore = await cookies()
  cookieStore.set('clinike-impersonating', JSON.stringify({
    superAdminEmail: superAdminUser.email,
    targetUserName: targetUser.name,
    targetClinicName: clinicName,
  }), {
    httpOnly: false, // banner client-side precisa ler pra exibir o nome
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12, // 12h — sessão de teste não deve ficar pendurada
  })
  return response
}
