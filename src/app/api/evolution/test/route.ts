import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url, api_key, instance_name } = await request.json()

    if (!url || !api_key) {
      return NextResponse.json({ success: false, error: 'URL e API Key são obrigatórios' }, { status: 400 })
    }

    // Limpar URL
    const baseUrl = url.replace(/\/$/, '')

    // Testar conexão buscando instâncias
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': api_key,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ 
        success: false, 
        error: `Erro ${response.status}: ${errorText}` 
      }, { status: 400 })
    }

    const instances = await response.json()

    // Verificar se a instância específica existe (se fornecida)
    if (instance_name) {
      const instanceExists = instances.some((i: any) => 
        i.instanceName === instance_name || i.instance?.instanceName === instance_name
      )
      
      if (!instanceExists) {
        return NextResponse.json({ 
          success: true, 
          warning: `Instância "${instance_name}" não encontrada. Instâncias disponíveis: ${instances.map((i: any) => i.instanceName || i.instance?.instanceName).join(', ')}`,
          instances 
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      instances,
      message: 'Conexão estabelecida com sucesso!'
    })

  } catch (error: any) {
    console.error('Evolution API test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro ao conectar com a Evolution API' 
    }, { status: 500 })
  }
}
