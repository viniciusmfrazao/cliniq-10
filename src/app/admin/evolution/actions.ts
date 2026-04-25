'use server'

import { revalidatePath } from 'next/cache'
import { isSuperAdmin } from '@/lib/super-admin'
import { setSetting, SETTING_KEYS, type SettingKey } from '@/lib/app-settings'
import { createClient } from '@/lib/supabase/server'

export async function saveEvolutionSettings(values: Record<string, string>) {
  if (!(await isSuperAdmin())) throw new Error('Não autorizado')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  for (const k of SETTING_KEYS) {
    if (k in values) {
      await setSetting(k as SettingKey, values[k] ?? '', user?.id)
    }
  }
  revalidatePath('/admin/evolution')
}

export async function testEvolutionConnection(args: {
  url: string
  apiKey: string
}): Promise<
  | { ok: true; instances: Array<{ name: string }> }
  | { ok: false; error: string }
> {
  if (!(await isSuperAdmin())) return { ok: false, error: 'Não autorizado' }
  const { url, apiKey } = args
  if (!url || !apiKey) return { ok: false, error: 'URL e API Key são obrigatórios' }

  const baseUrl = url.replace(/\/$/, '')
  try {
    const r = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    })
    if (!r.ok) {
      const txt = await r.text()
      return { ok: false, error: `Evolution ${r.status}: ${txt.slice(0, 200)}` }
    }
    const raw = await r.json()
    const list = Array.isArray(raw) ? raw : []
    const instances = list.map((i: { instanceName?: string; instance?: { instanceName?: string } }) => ({
      name: i.instanceName ?? i.instance?.instanceName ?? '',
    }))
    return { ok: true, instances }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de conexão' }
  }
}

export async function generateWebhookSecret(): Promise<string> {
  if (!(await isSuperAdmin())) throw new Error('Não autorizado')
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
