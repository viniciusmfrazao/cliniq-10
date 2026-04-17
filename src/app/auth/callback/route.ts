import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const error_description = searchParams.get('error_description')
  
  // Se tiver erro, redireciona para login
  if (error_description) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }
  
  const supabase = await createClient()
  
  // Recovery com token_hash
  if (token_hash && type === 'recovery') {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'recovery'
      })
      
      if (!error) {
        return NextResponse.redirect(`${origin}/redefinir-senha`)
      }
    } catch (e) {
      console.error('Recovery error:', e)
    }
    return NextResponse.redirect(`${origin}/login?error=recovery`)
  }
  
  // Recovery com code
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      // Verifica se é recovery pelo tipo de sessão
      if (type === 'recovery' || data.session.user?.recovery_sent_at) {
        return NextResponse.redirect(`${origin}/redefinir-senha`)
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }
  
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
