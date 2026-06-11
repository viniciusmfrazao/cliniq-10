import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/entrar', '/cadastro', '/auth/callback', '/planos', '/esqueci-senha', '/redefinir-senha']
const PUBLIC_PREFIXES = ['/api/documents/sign', '/assinar/', '/anamnese/', '/confirmar/']
const ADMIN_ROUTES = ['/admin']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Cookie antigo presente mas sem o correto: limpa tudo e manda pro login
  const hasOldCookie = request.cookies.has('clinike-auth-token')
  const hasNewCookie = request.cookies.has('sb-yqrjbyaucimvmzpfipgs-auth-token')
  if (hasOldCookie && !hasNewCookie && path !== '/api/auth/clear-session') {
    return NextResponse.redirect(new URL('/api/auth/clear-session', request.url))
  }

  // Skip auth check for public routes (faster)
  if (PUBLIC_ROUTES.includes(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }

  // APIs autenticam por conta propria (Supabase token, webhook_token, CRON_SECRET, etc).
  // Especialmente webhooks de servicos externos (Evolution, n8n) NUNCA podem cair no
  // auth check do middleware — sao chamados sem cookie de sessao, e redirect pra
  // /login faz o servico externo descartar a chamada.
  if (path.startsWith('/api/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Check session from cookie first (faster than getUser)
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'
  ],
}
