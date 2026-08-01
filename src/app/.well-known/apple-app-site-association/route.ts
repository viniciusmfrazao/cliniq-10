import { NextResponse } from 'next/server'

// Habilita o iOS Password AutoFill (Chaveiro) dentro da WKWebView do app
// nativo Capacitor, associando este dominio ao App ID br.com.clinike.app.
// Precisa ficar acessivel em https://app.clinike.com.br/.well-known/apple-app-site-association
// sem redirecionamento e com Content-Type application/json.
export async function GET() {
  return NextResponse.json({
    applinks: {},
    webcredentials: {
      apps: ['76VU7DUUYA.br.com.clinike.app'],
    },
  })
}
