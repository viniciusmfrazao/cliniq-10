import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const AUTH_COOKIE_NAMES = [
  'sb-yqrjbyaucimvmzpfipgs-auth-token',
  'clinike-auth-token',
]

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll()
          const hasStandard = all.some(c => c.name === 'sb-yqrjbyaucimvmzpfipgs-auth-token')
          if (!hasStandard) {
            const alt = all.find(c => AUTH_COOKIE_NAMES.includes(c.name))
            if (alt) {
              return [...all, { name: 'sb-yqrjbyaucimvmzpfipgs-auth-token', value: alt.value }]
            }
          }
          return all
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[createServiceClient] FATAL: SUPABASE_SERVICE_ROLE_KEY ou URL ausente!')
  }
  return createSupabaseClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
