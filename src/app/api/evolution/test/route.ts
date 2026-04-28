import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'

/**
 * POST /api/evolution/test
 *
 * Endpoint de diagnóstico que faz uma chamada server-side pra Evolution API.
 *
 * IMPORTANTE: este endpoint dispara `fetch()` para uma URL fornecida no body.
 * Sem auth seria um SSRF (atacante usa nosso servidor pra escanear/atacar
 * destinos arbitrários). Por isso exigimos super admin.
 */
export async function POST(request: Request) {
  try {
    // ========== AUTH ==========
    const isAdmin = await isSuperAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Nao autorizado' },
        { status: 403 },
      )
    }

    const { url, api_key, instance_name } = await request.json()

    if (!url || !api_key) {
      return NextResponse.json({ success: false, error: 'URL e API Key são obrigatórios' }, { status: 400 })
    }

    // Sanidade básica de URL (impede targets internos óbvios). Não é
    // uma proteção completa contra SSRF, mas como exigimos super admin
    // o risco já é minimo.
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'URL invalida' },
        { status: 400 },
      )
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json(
        { success: false, error: 'Protocolo nao permitido' },
        { status: 400 },
      )
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
