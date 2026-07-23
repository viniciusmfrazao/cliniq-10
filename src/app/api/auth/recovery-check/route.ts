import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const RECOVERY_COOKIE = 'clinike_recovery_verified'

/**
 * Verifica se a sessao atual foi estabelecida por um clique genuino no
 * link de recuperacao de senha (cookie httpOnly setado por /auth/callback),
 * e consome o cookie (uso unico) para que nao possa ser reutilizado.
 *
 * Isso existe para NAO usar "existe uma sessao ativa no navegador" como
 * prova de recuperacao de senha — uma sessao normal de login (dashboard)
 * nao deve ser suficiente para pular a troca de senha sem verificacao.
 */
export async function GET() {
  const cookieStore = await cookies()
  const verified = cookieStore.get(RECOVERY_COOKIE)?.value === '1'

  if (verified) {
    cookieStore.delete(RECOVERY_COOKIE)
  }

  return NextResponse.json({ verified }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
