'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

const TIPO_LABEL: Record<string, string> = {
  faturamento: 'faturamento',
  atendimentos: 'atendimentos',
  procedimento: 'procedimento',
  novos_pacientes: 'novos pacientes',
}

/**
 * Roda uma vez por sessão (mount do layout), fora da cadeia de fetches
 * sequenciais do dashboard/layout.tsx — não adiciona latência à navegação.
 * Chama fn_metas_batidas_pendentes() (leve: só olha metas do período ativo)
 * e, se houver meta batida ainda não vista pelo usuário, mostra confete.
 */
export default function MetaBatidaCelebration() {
  const [pendente, setPendente] = useState<{ meta_id: string; tipo: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function check() {
      const { data, error } = await supabase.rpc('fn_metas_batidas_pendentes')
      if (error) {
        console.error('fn_metas_batidas_pendentes falhou:', error)
        return
      }
      if (cancelled || !data || data.length === 0) return

      const primeira = data[0]
      setPendente(primeira)

      // marca como vista pra não repetir em outra navegação/aba
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        await supabase.from('metas_notificacoes').insert({
          meta_id: primeira.meta_id,
          user_id: userData.user.id,
        })
      }

      if (typeof window !== 'undefined') {
        const confetti = (await import('canvas-confetti')).default
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } })
      }

      setTimeout(() => {
        if (!cancelled) setPendente(null)
      }, 8000)
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (!pendente) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in-95">
        <Icon name="check" className="w-6 h-6" />
        <p className="text-lg font-semibold">
          Meta de {TIPO_LABEL[pendente.tipo] || pendente.tipo} batida! 🎉
        </p>
      </div>
    </div>
  )
}
