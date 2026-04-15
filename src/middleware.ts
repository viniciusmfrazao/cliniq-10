import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/cadastro', '/auth/callback', '/planos', '/esqueci-senha', '/redefinir-senha', '/assinar']
const PUBLIC_PREFIXES = ['/api/documents/sign', '/assinar/']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Skip auth check for public routes (faster)
  if (PUBLIC_ROUTES.includes(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }

  // Skip auth check for static files and API routes that don't need auth
  if (path.startsWith('/api/') && !path.startsWith('/api/webhooks')) {
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
