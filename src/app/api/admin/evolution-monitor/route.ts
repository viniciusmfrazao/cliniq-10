import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { getSetting } from '@/lib/app-settings'

/**
 * GET /api/admin/evolution-monitor
 * Retorna status do Evolution + instâncias conectadas
 *
 * POST /api/admin/evolution-monitor
 * { action: 'clean_messages', days: number }
 * Limpa mensagens antigas via Evolution API sem derrubar instâncias
 */

export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const url = (await getSetting('evolution_url'))?.replace(/\/$/, '')
  const key = await getSetting('evolution_master_key')

  if (!url || !key) {
    return NextResponse.json({ error: 'Evolution não configurado' }, { status: 400 })
  }

  try {
    // Buscar todas as instâncias
    const r = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key },
    })
    const raw = await r.json()
    const instances = Array.isArray(raw) ? raw : []

    const summary = instances.map((i: {
      instance?: { instanceName?: string; status?: string; owner?: string }
      instanceName?: string
      status?: string
    }) => ({
      name: i.instance?.instanceName ?? i.instanceName ?? '',
      status: i.instance?.status ?? i.status ?? 'unknown',
      owner: i.instance?.owner ?? '',
      connected: (i.instance?.status ?? i.status) === 'open',
    }))

    const connected = summary.filter((i: { connected: boolean }) => i.connected).length
    const total = summary.length

    return NextResponse.json({
      ok: true,
      evolution_url: url,
      instances: summary,
      connected,
      total,
      warning: total > 10 ? 'Muitas instâncias — considere limpar as desconectadas' : null,
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Falha ao conectar no Evolution',
    }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json() as { action: string; days?: number }
  const url = (await getSetting('evolution_url'))?.replace(/\/$/, '')
  const key = await getSetting('evolution_master_key')

  if (!url || !key) {
    return NextResponse.json({ error: 'Evolution não configurado' }, { status: 400 })
  }

  if (body.action === 'clean_disconnected') {
    // Buscar instâncias desconectadas e deletar APENAS as que não estão no banco do Clinike
    const { createServiceClient } = await import('@/lib/supabase/server')
    const svc = createServiceClient()

    const r = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key },
    })
    const raw = await r.json()
    const instances = Array.isArray(raw) ? raw : []

    // Pegar nomes de instâncias ativas no banco do Clinike
    const { data: dbInstances } = await svc
      .from('clinic_whatsapp')
      .select('instance_name, status')

    const activeInDb = new Set((dbInstances ?? []).map((i: { instance_name: string }) => i.instance_name))

    const toDelete = instances.filter((i: {
      instance?: { instanceName?: string; status?: string }
      instanceName?: string
      status?: string
    }) => {
      const name = i.instance?.instanceName ?? i.instanceName ?? ''
      const status = i.instance?.status ?? i.status ?? ''
      // Só deleta se NÃO está no banco do Clinike E está fechada
      return !activeInDb.has(name) && status !== 'open'
    })

    let deleted = 0
    const errors: string[] = []

    for (const inst of toDelete) {
      const name = inst.instance?.instanceName ?? inst.instanceName ?? ''
      try {
        await fetch(`${url}/instance/delete/${name}`, {
          method: 'DELETE',
          headers: { apikey: key },
        })
        deleted++
      } catch (e) {
        errors.push(name)
      }
    }

    return NextResponse.json({
      ok: true,
      deleted,
      errors,
      message: `${deleted} instâncias órfãs removidas. ${errors.length} erros.`,
    })
  }

  return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
}
