import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'

// Extrai o project ref da URL do Supabase (funciona em prod e staging)
// Ex: https://yqrjbyaucimvmzpfipgs.supabase.co → yqrjbyaucimvmzpfipgs
function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] ?? 'yqrjbyaucimvmzpfipgs'
}

function getAuthCookieNames(): string[] {
  return [
    `sb-${getProjectRef()}-auth-token`,
    'clinike-auth-token',
  ]
}

export async function createClient() {
  const cookieStore = await cookies()
  const standardCookieName = `sb-${getProjectRef()}-auth-token`

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll()
          const hasStandard = all.some(c => c.name === standardCookieName)
          if (!hasStandard) {
            const alt = all.find(c => getAuthCookieNames().includes(c.name))
            if (alt) {
              return [...all, { name: standardCookieName, value: alt.value }]
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

// Memoiza auth.getUser() por request (React cache dedup) — evita repetir a
// verificação de JWT (chamada de rede ao Auth do Supabase) toda vez que o
// layout e a página chamam getUser() na mesma navegação. Mesma assinatura
// de retorno (`User | null`) do padrão antigo, então é drop-in replacement
// de `const { data: { user } } = await supabase.auth.getUser()`.
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

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
