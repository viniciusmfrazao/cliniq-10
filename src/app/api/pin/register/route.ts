export const dynamic = 'force-dynamic'

import { createHash } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Cadastra este aparelho como confiável.
 *
 * O cliente gera um segredo aleatório de 256 bits, guarda-o cifrado com o PIN
 * e manda o valor cru aqui uma única vez. O banco só fica com o SHA-256 —
 * vazamento da tabela não permite destravar nada.
 *
 * Precisa de sessão válida: só quem acabou de entrar com senha cadastra PIN.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'nao_autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const secret = typeof body?.secret === 'string' ? body.secret : ''
    const label = typeof body?.label === 'string' ? body.label.slice(0, 80) : null

    // 256 bits em base64 = 44 chars. Abaixo disso não é um segredo gerado por nós.
    if (secret.length < 40) {
      return NextResponse.json({ error: 'segredo_invalido' }, { status: 400 })
    }

    const secretHash = createHash('sha256').update(secret).digest('hex')
    const service = createServiceClient()

    const { data, error } = await service
      .from('pin_devices')
      .insert({
        user_id: user.id,
        secret_hash: secretHash,
        label,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[pin/register] falha ao gravar aparelho:', error)
      return NextResponse.json({ error: 'falha_ao_cadastrar' }, { status: 500 })
    }

    return NextResponse.json({ deviceId: data.id, email: user.email })
  } catch (err) {
    console.error('[pin/register] erro inesperado:', err)
    return NextResponse.json({ error: 'erro_inesperado' }, { status: 500 })
  }
}
