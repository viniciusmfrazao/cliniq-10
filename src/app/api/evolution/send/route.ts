import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { config, phone, message } = await request.json()

    if (!config?.url || !config?.api_key || !config?.instance_name) {
      return NextResponse.json({ success: false, error: 'Configuração incompleta' }, { status: 400 })
    }

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'Telefone e mensagem são obrigatórios' }, { status: 400 })
    }

    const baseUrl = config.url.replace(/\/$/, '')
    
    // Formatar número (adicionar 55 se necessário)
    let formattedPhone = phone.replace(/\D/g, '')
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone
    }

    const response = await fetch(`${baseUrl}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'apikey': config.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ 
        success: false, 
        error: `Erro ao enviar: ${errorText}` 
      }, { status: 400 })
    }

    const result = await response.json()

    return NextResponse.json({ 
      success: true, 
      result
    })

  } catch (error: any) {
    console.error('Evolution send error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro ao enviar mensagem' 
    }, { status: 500 })
  }
}
