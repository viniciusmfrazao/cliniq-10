import { createServiceClient } from '@/lib/supabase/server'

export const SETTING_KEYS = [
  'evolution_url',
  'evolution_master_key',
  'evolution_webhook_secret',
  'n8n_donna_url',
  'n8n_donna_secret',
  'eva_engine',
  'eva_edge_url',
  'eva_internal_secret',
] as const

export type SettingKey = typeof SETTING_KEYS[number]

type CacheEntry = { value: string | null; expiresAt: number }
const cache = new Map<SettingKey, CacheEntry>()
const TTL_MS = 60_000

function normalizeSettingValue(key: SettingKey, value: string | null): string | null {
  // n8n is no longer an Eva runtime. Keep legacy keys readable for old rows,
  // but never allow them to route production WhatsApp traffic.
  if (key === 'eva_engine') return 'edge'
  if (key === 'n8n_donna_url' || key === 'n8n_donna_secret') return null
  return value
}

function getCached(key: SettingKey): string | null | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (hit.expiresAt < Date.now()) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

function setCached(key: SettingKey, value: string | null) {
  cache.set(key, { value: normalizeSettingValue(key, value), expiresAt: Date.now() + TTL_MS })
}

export function invalidateSettingsCache(key?: SettingKey) {
  if (key) cache.delete(key)
  else cache.clear()
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  const cached = getCached(key)
  if (cached !== undefined) return cached

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  const value = normalizeSettingValue(key, data?.value ?? null)
  setCached(key, value)
  return value
}

export async function getSettings<K extends SettingKey>(
  keys: readonly K[]
): Promise<Record<K, string | null>> {
  const result = {} as Record<K, string | null>
  const missing: K[] = []

  for (const k of keys) {
    const cached = getCached(k)
    if (cached !== undefined) {
      result[k] = cached
    } else {
      missing.push(k)
    }
  }

  if (missing.length === 0) return result

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', missing as string[])

  for (const k of missing) {
    const row = data?.find(r => r.key === k)
    const value = normalizeSettingValue(k, row?.value ?? null)
    setCached(k, value)
    result[k] = value
  }
  return result
}

export async function setSetting(
  key: SettingKey,
  value: string,
  updatedBy?: string
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    })
  if (error) throw error
  invalidateSettingsCache(key)
}

export async function getAllSettings(): Promise<
  Array<{ key: string; value: string | null; is_secret: boolean; description: string | null; updated_at: string }>
> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_settings')
    .select('key, value, is_secret, description, updated_at')
    .order('key')
  return data ?? []
}
