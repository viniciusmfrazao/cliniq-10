'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

const STORAGE_KEY = 'clinike_novidade_v4_jul2026'
const EXPIRA_EM_DIAS = 7

const NOVIDADES = [
  { emoji: '🔮', texto: 'Previsão de Faturamento: veja quanto vai entrar com os agendamentos futuros' },
  { emoji: '💳', texto: 'Valor cobrado pela profissional pré-preenchido no pagamento' },
  { emoji: '✏️', texto: 'Edição de entradas e saídas financeiras' },
  { emoji: '📊', texto: 'Rentabilidade por paciente: custo, receita e margem real' },
  { emoji: '📦', texto: 'Edição de movimentações de estoque com ajuste automático' },
  { emoji: '🔁', texto: 'Recall multi-step: sequência de mensagens em múltiplos intervalos' },
]

export default function NovidadeBanner() {
  const [visible, setVisible] = useState(false)
  const [expandido, setExpandido] = useState(false)

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
    <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-4 md:p-5 text-white shadow-lg shadow-violet-500/25 mb-2 overflow-hidden">
      {/* Decoração de fundo */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-20 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />

      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-xl">
          🚀
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold bg-white/25 px-2.5 py-0.5 rounded-full tracking-wide uppercase">
              Novidade · Jul/2026
            </span>
          </div>

          <p className="font-bold text-base md:text-lg leading-tight">
            Chegou o áudio nas automações! 🎙️
          </p>
          <p className="text-white/80 text-xs md:text-sm mt-1 leading-relaxed">
            Agora dá pra gravar um áudio e configurar cada automação (lembrete, confirmação, aniversário, pós-atendimento, pós-venda) pra mandar texto, áudio, ou os dois. E ainda vieram mais novidades:
          </p>

          {/* Lista de novidades */}
          <div className="mt-3 space-y-1.5">
            {(expandido ? NOVIDADES : NOVIDADES.slice(0, 3)).map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-xs md:text-sm">
                <span className="flex-shrink-0 mt-0.5">{n.emoji}</span>
                <span className="text-white/90">{n.texto}</span>
              </div>
            ))}
          </div>

          {!expandido && NOVIDADES.length > 3 && (
            <button
              onClick={() => setExpandido(true)}
              className="mt-2 text-xs text-white/70 hover:text-white underline underline-offset-2 transition-colors"
            >
              + {NOVIDADES.length - 3} novidades a mais
            </button>
          )}

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <Link
              href="/dashboard/config/automacoes"
              onClick={fechar}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-violet-600 rounded-xl text-sm font-bold hover:bg-violet-50 transition-colors shadow-sm"
            >
              Configurar áudio nas automações
              <Icon name="chevronRight" className="w-4 h-4" />
            </Link>
            <button
              onClick={fechar}
              className="text-xs text-white/70 hover:text-white transition-colors underline underline-offset-2"
            >
              Já vi, obrigado!
            </button>
          </div>
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
