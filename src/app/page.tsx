import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()

  let user = null
  try {
    // Timeout curto: se o Auth do Supabase travar/der timeout (522), não
    // deixa a home travar em branco — cai no fallback de /login em vez de
    // esperar indefinidamente.
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth_timeout')), 5000)),
    ])
    user = result.data.user
  } catch {
    user = null
  }

  redirect(user ? '/dashboard' : '/login')
}
