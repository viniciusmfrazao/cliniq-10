import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/entrar', '/cadastro', '/auth/callback', '/planos', '/esqueci-senha', '/redefinir-senha']
const PUBLIC_PREFIXES = ['/api/documents/sign', '/assinar/', '/anamnese/', '/confirmar/']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/api/')) return NextResponse.next()

  const isPublic = PUBLIC_ROUTES.includes(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))
  if (isPublic) return NextResponse.next()

  const oldCookie = request.cookies.get('clinike-auth-token')
  const newCookie = request.cookies.get('sb-yqrjbyaucimvmzpfipgs-auth-token')

  if (!oldCookie && !newCookie) {
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
          const hasNew = all.some(c => c.name === 'sb-yqrjbyaucimvmzpfipgs-auth-token')
          if (!hasNew && oldCookie) {
            return [...all, { name: 'sb-yqrjbyaucimvmzpfipgs-auth-token', value: oldCookie.value }]
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

  // Migra cookie antigo para o novo automaticamente
  if (oldCookie && !newCookie) {
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
