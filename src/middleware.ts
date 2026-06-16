import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/entrar', '/cadastro', '/auth/callback', '/planos', '/esqueci-senha', '/redefinir-senha']
const PUBLIC_PREFIXES = ['/api/documents/sign', '/assinar/', '/anamnese/', '/confirmar/']

// Extrai o project ref da URL do Supabase — funciona em prod e staging
function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] ?? 'yqrjbyaucimvmzpfipgs'
}

// Nomes de cookie aceitos — o @supabase/ssr pode gerar qualquer um desses
function getAuthCookieNames(): string[] {
  return [
    `sb-${getProjectRef()}-auth-token`,
    'clinike-auth-token',
  ]
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/api/')) return NextResponse.next()

  const isPublic = PUBLIC_ROUTES.includes(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))
  if (isPublic) return NextResponse.next()

  const AUTH_COOKIE_NAMES = getAuthCookieNames()
  const standardCookieName = `sb-${getProjectRef()}-auth-token`

  // Verifica se tem qualquer cookie de auth válido
  const authCookie = AUTH_COOKIE_NAMES.map(name => request.cookies.get(name)).find(Boolean)
  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = request.cookies.getAll()
          // Garante que o cookie correto está presente com o nome padrão
          const hasStandard = all.some(c => c.name === standardCookieName)
          if (!hasStandard) {
            const alt = all.find(c => AUTH_COOKIE_NAMES.includes(c.name))
            if (alt) {
              return [...all, { name: standardCookieName, value: alt.value }]
            }
          }
          return all
        },
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
