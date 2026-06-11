import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/entrar', '/cadastro', '/auth/callback', '/planos', '/esqueci-senha', '/redefinir-senha']
const PUBLIC_PREFIXES = ['/api/documents/sign', '/assinar/', '/anamnese/', '/confirmar/']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/api/')) return NextResponse.next()

  const isPublic = PUBLIC_ROUTES.includes(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))

  // Aceita os dois nomes de cookie — antigo e novo
  // Isso resolve para todos os usuários sem precisar limpar nada
  const oldCookie = request.cookies.get('clinike-auth-token')
  const newCookie = request.cookies.get('sb-yqrjbyaucimvmzpfipgs-auth-token')
  const sessionCookie = newCookie || oldCookie

  if (isPublic) return NextResponse.next()

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Cria response passando o cookie correto para o Supabase validar
  const requestWithCookie = new Request(request.url, {
    headers: request.headers,
    method: request.method,
  })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Retorna os cookies normais + mapeia o antigo para o nome novo
          const all = request.cookies.getAll()
          const hasNew = all.some(c => c.name === 'sb-yqrjbyaucimvmzpfipgs-auth-token')
          if (!hasNew && oldCookie) {
            return [...all, { name: 'sb-yqrjbyaucimvmzpfipgs-auth-token', value: oldCookie.value }]
          }
          return all
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
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

  // Se o usuário tem só o cookie antigo, seta o novo também na resposta
  if (oldCookie && !newCookie && session) {
    response.cookies.set('sb-yqrjbyaucimvmzpfipgs-auth-token', oldCookie.value, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
    response.cookies.set('clinike-auth-token', '', {
      expires: new Date(0),
      path: '/',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
