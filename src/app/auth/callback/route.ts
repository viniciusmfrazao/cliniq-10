import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Se for recuperacao de senha, redireciona para pagina de redefinir
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/redefinir-senha`)
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }
  
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
