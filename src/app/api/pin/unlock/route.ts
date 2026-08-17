export const dynamic = 'force-dynamic'

import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MAX_FAILED = 10

/**
 * Destrava o aparelho e cria uma SESSÃO NOVA.
 *
 * Este é o ponto central do desenho: não restauramos a sessão antiga a partir
 * de um refresh_token guardado. Aquele token rotaciona, é revogado por
 * signOut/troca de senha e some quando o GoTrue detecta reuso — foi
 * exatamente o que fazia o PIN morrer com refresh_token_not_found.
 *
 * Aqui o segredo do aparelho é estável: validamos o hash e emitimos uma
 * sessão limpa via generateLink + verifyOtp, que grava os cookies do
 * @supabase/ssr na resposta.
 *
 * Rota pública por necessidade (quem chega aqui não tem sessão). A proteção
 * é a entropia do segredo (256 bits) somada ao bloqueio por tentativas.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : ''
    const secret = typeof body?.secret === 'string' ? body.secret : ''

    if (!deviceId || !secret) {
      return NextResponse.json({ error: 'requisicao_invalida' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: device } = await service
      .from('pin_devices')
      .select('id, user_id, secret_hash, failed_attempts, revoked_at')
      .eq('id', deviceId)
      .maybeSingle()

    if (!device || device.revoked_at) {
      return NextResponse.json({ error: 'aparelho_desconhecido' }, { status: 401 })
    }

    if (device.failed_attempts >= MAX_FAILED) {
      return NextResponse.json({ error: 'aparelho_bloqueado' }, { status: 401 })
    }

    // Comparação em tempo constante para não vazar o hash por timing.
    const expected = Buffer.from(device.secret_hash, 'hex')
    const received = createHash('sha256').update(secret).digest()
    const ok = expected.length === received.length && timingSafeEqual(expected, received)

    if (!ok) {
      await service
        .from('pin_devices')
        .update({ failed_attempts: device.failed_attempts + 1 })
        .eq('id', device.id)
      return NextResponse.json({ error: 'segredo_invalido' }, { status: 401 })
    }

    const { data: userData, error: userError } = await service.auth.admin.getUserById(
      device.user_id
    )
    const email = userData?.user?.email

    if (userError || !email) {
      return NextResponse.json({ error: 'usuario_invalido' }, { status: 401 })
    }

    // Sessão nova: o link não é enviado por email, só geramos o token_hash.
    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    const tokenHash = link?.properties?.hashed_token
    if (linkError || !tokenHash) {
      console.error('[pin/unlock] falha ao gerar link:', linkError)
      return NextResponse.json({ error: 'falha_ao_criar_sessao' }, { status: 500 })
    }

    // O client de servidor grava os cookies de sessão na resposta.
    const supabase = await createClient()
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })

    if (otpError) {
      console.error('[pin/unlock] falha no verifyOtp:', otpError)
      return NextResponse.json({ error: 'falha_ao_criar_sessao' }, { status: 500 })
    }

    await service
      .from('pin_devices')
      .update({ last_used_at: new Date().toISOString(), failed_attempts: 0 })
      .eq('id', device.id)

    return NextResponse.json({ ok: true, email })
  } catch (err) {
    console.error('[pin/unlock] erro inesperado:', err)
    return NextResponse.json({ error: 'erro_inesperado' }, { status: 500 })
  }
}
