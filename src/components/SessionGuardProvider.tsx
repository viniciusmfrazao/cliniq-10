'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

const DEVICE_ID_KEY = 'clinike_device_id'
const HEARTBEAT_MS = 5 * 60 * 1000 // 5 min — também re-checa o limite de dispositivos
const MAX_SESSIONS = 5

function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    // localStorage indisponível (modo privado etc.) — gera um id de sessão,
    // sem persistir. Pior caso: conta como dispositivo novo a cada load.
    return crypto.randomUUID()
  }
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent
  let device = 'Desktop'
  if (/iPad/.test(ua)) device = 'iPad'
  else if (/iPhone/.test(ua)) device = 'iPhone'
  else if (/Android/.test(ua)) device = /Mobile/.test(ua) ? 'Android' : 'Tablet Android'
  else if (/Macintosh/.test(ua)) device = 'Mac'
  else if (/Windows/.test(ua)) device = 'Windows'

  let browser = ''
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua) && !/CriOS/.test(ua)) browser = 'Chrome'
  else if (/CriOS/.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'

  return browser ? `${device} · ${browser}` : device
}

/**
 * Limite de dispositivos simultâneos por usuário (padrão 5). Ao registrar/
 * atualizar a sessão (login ou heartbeat), o backend (fn_register_session)
 * derruba as sessões mais antigas por último uso quando o limite é
 * ultrapassado. Aqui a gente escuta um canal de broadcast (não postgres_changes,
 * porque a linha derrubada já foi deletada) pra avisar o dispositivo atingido
 * na hora, e também avisamos os outros dispositivos quando somos nós que
 * derrubamos alguém.
 *
 * Fica no layout raiz (fora do ToastProvider), então não usa toast — o
 * dispositivo derrubado é redirecionado pro /login com um motivo na URL,
 * que a própria página de login exibe.
 */
export default function SessionGuardProvider() {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const deviceIdRef = useRef<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const supabase = createClient()
    let cancelled = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    async function registerAndReconcile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const deviceId = getOrCreateDeviceId()
      deviceIdRef.current = deviceId

      // Garante que o canal deste usuário está escutando ANTES de registrar,
      // pra não perder um kick que chegue logo em seguida.
      if (!channelRef.current) {
        const channel = supabase.channel(`session-guard:${user.id}`)
        channel
          .on('broadcast', { event: 'kick' }, ({ payload }) => {
            const kickedIds: string[] = payload?.device_ids ?? []
            if (kickedIds.includes(deviceIdRef.current)) {
              handleKicked()
            }
          })
          .subscribe()
        channelRef.current = channel
      }

      const { data, error } = await supabase.rpc('fn_register_session', {
        p_device_id: deviceId,
        p_device_label: getDeviceLabel(),
        p_max_sessions: MAX_SESSIONS,
      })

      if (error || cancelled) return

      const kickedIds: string[] = (data ?? []).map((row: { kicked_device_id: string }) => row.kicked_device_id)
      if (kickedIds.length > 0 && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'kick',
          payload: { device_ids: kickedIds },
        })
      }
    }

    async function handleKicked() {
      if (cancelled) return
      cancelled = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      await supabase.auth.signOut()
      window.location.href = '/login?motivo=limite-dispositivos'
    }

    registerAndReconcile()
    heartbeatTimer = setInterval(registerAndReconcile, HEARTBEAT_MS)

    return () => {
      cancelled = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  return null
}
