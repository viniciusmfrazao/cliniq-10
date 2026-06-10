import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'clinike-auth-token',
        storage: {
          getItem: (key: string) => {
            try { return window.localStorage.getItem(key) } catch { return null }
          },
          setItem: (key: string, value: string) => {
            try { window.localStorage.setItem(key, value) } catch {}
          },
          removeItem: (key: string) => {
            try { window.localStorage.removeItem(key) } catch {}
          },
        },
      },
    }
  )
}
