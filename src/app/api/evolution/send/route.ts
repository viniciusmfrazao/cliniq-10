import { NextResponse } from 'next/server'

/**
 * @deprecated Removida. Use POST /api/whatsapp/send.
 * Rota desativada por segurança — não tinha autenticação.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Esta rota foi removida. Use /api/whatsapp/send.' },
    { status: 410 }
  )
}
