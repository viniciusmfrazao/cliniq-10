import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/entrar', '/cadastro', '/auth/callback', '/planos', '/esqueci-senha', '/redefinir-senha']
const PUBLIC_PREFIXES = ['/api/documents/sign', '/assinar/', '/anamnese/', '/confirmar/']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // APIs autenticam por conta propria
  if (path.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Rotas públicas — passa direto MAS sempre apaga o cookie antigo
  const isPublic = PUBLIC_ROUTES.includes(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))
  
  let response = isPublic
    ? NextResponse.next()
    : NextResponse.next({ request })

  // SEMPRE apaga o cookie antigo via Set-Cookie no servidor
  // Isso resolve para TODOS os usuários sem precisar de JS no cliente
  if (request.cookies.has('clinike-auth-token')) {
    response.cookies.set('clinike-auth-token', '', {
      expires: new Date(0),
      path: '/',
    })
  }

  if (isPublic) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          // Reaplica a limpeza do cookie antigo após recriar o response
          if (request.cookies.has('clinike-auth-token')) {
            response.cookies.set('clinike-auth-token', '', {
              expires: new Date(0),
              path: '/',
            })
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
