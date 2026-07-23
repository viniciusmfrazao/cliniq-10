import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

// Nome do cookie de uso unico que prova que a sessao foi estabelecida
// por um link de recuperacao de senha genuino (nao apenas "existe uma
// sessao ativa no navegador"). Ver /api/auth/recovery-check.
const RECOVERY_COOKIE = 'clinike_recovery_verified'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const error_description = searchParams.get('error_description')
  
  // Se tiver erro, redireciona para tela que explica o que houve
  // (login nao mostra nada sobre erro=..., ficava parecendo que "sumiu")
  if (error_description) {
    return NextResponse.redirect(`${origin}/redefinir-senha`)
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
        const response = NextResponse.redirect(`${origin}/redefinir-senha`)
        response.cookies.set(RECOVERY_COOKIE, '1', {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 300, // 5 minutos, uso unico (consumido em /api/auth/recovery-check)
          path: '/',
        })
        return response
      }
      console.error('Recovery verifyOtp error:', error.message)
    } catch (e) {
      console.error('Recovery error:', e)
    }
    return NextResponse.redirect(`${origin}/redefinir-senha`)
  }
  
  // Recovery com code
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      // Verifica se é recovery pelo tipo de sessão
      if (type === 'recovery' || data.session.user?.recovery_sent_at) {
        const response = NextResponse.redirect(`${origin}/redefinir-senha`)
        response.cookies.set(RECOVERY_COOKIE, '1', {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 300,
          path: '/',
        })
        return response
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
    if (error) console.error('Recovery exchangeCodeForSession error:', error.message)
  }
  
  return NextResponse.redirect(`${origin}/redefinir-senha`)
}
