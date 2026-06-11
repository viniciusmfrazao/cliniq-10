export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  
  // Limpa TODOS os possíveis cookies de sessão do Supabase
  const cookieNames = [
    'clinike-auth-token',
    'sb-yqrjbyaucimvmzpfipgs-auth-token',
    'sb-access-token',
    'sb-refresh-token',
  ]
  
  for (const name of cookieNames) {
    response.cookies.set(name, '', {
      expires: new Date(0),
      path: '/',
    })
  }
  
  return response
}
