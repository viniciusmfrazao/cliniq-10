import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll()
          // Aceita tanto o cookie novo quanto o antigo
          const hasNew = all.some(c => c.name === 'sb-yqrjbyaucimvmzpfipgs-auth-token')
          const oldCookie = all.find(c => c.name === 'clinike-auth-token')
          if (!hasNew && oldCookie) {
            return [...all, { name: 'sb-yqrjbyaucimvmzpfipgs-auth-token', value: oldCookie.value }]
          }
          return all
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookies can only be set in a Server Action or Route Handler
          }
        },
      },
    }
  )
}

// Service role client for admin operations
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[createServiceClient] FATAL: SUPABASE_SERVICE_ROLE_KEY ou URL ausente nas env vars!')
  }
  return createSupabaseClient(url!, key!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
