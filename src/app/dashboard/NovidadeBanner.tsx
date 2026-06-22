'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

const STORAGE_KEY = 'clinike_novidade_orcamento_ia_v1'
const EXPIRA_EM_DIAS = 3

export default function NovidadeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const fechado = localStorage.getItem(STORAGE_KEY)
      if (fechado) {
        const diasPassados = (Date.now() - Number(fechado)) / (1000 * 60 * 60 * 24)
        if (diasPassados < EXPIRA_EM_DIAS) return
      }
      setVisible(true)
    } catch {}
  }, [])

  function fechar() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="relative bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 md:p-5 text-white shadow-lg shadow-violet-500/20 mb-2">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xl">✨</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-white/25 px-2 py-0.5 rounded-full">
              ✨ Novidade no Clinike
            </span>
          </div>
          <p className="font-semibold text-sm md:text-base">
            Orçamento Campeão: mensagens personalizadas com IA!
          </p>
          <p className="text-white/80 text-xs md:text-sm mt-1">
            Ao enviar um orçamento pelo WhatsApp, a IA gera automaticamente uma mensagem personalizada para cada paciente — com o nome, o procedimento e o contexto dela. Você edita e envia com um clique.
          </p>
          <Link
            href="/dashboard/pacientes"
            onClick={fechar}
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-white text-violet-600 rounded-xl text-sm font-semibold hover:bg-violet-50 transition-colors"
          >
            Ver pacientes
            <Icon name="chevronRight" className="w-4 h-4" />
          </Link>
        </div>
        <button
          onClick={fechar}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          aria-label="Fechar"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
