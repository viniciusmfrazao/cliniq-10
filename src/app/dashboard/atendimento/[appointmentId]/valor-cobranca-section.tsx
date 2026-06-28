'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

type Props = {
  appointmentId: string
  procedurePrice: number | null
  initialValorCobrado: number | null
}

export default function ValorCobrancaSection({
  appointmentId,
  procedurePrice,
  initialValorCobrado,
}: Props) {
  const supabase = createClient()
  const toast = useToast()

  // Se já tem valor_cobrado salvo usa ele, senão usa preço do procedimento
  const defaultVal = initialValorCobrado !== null
    ? initialValorCobrado
    : (procedurePrice ?? 0)

  const [draft, setDraft] = useState(String(defaultVal))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const numVal = parseFloat(draft.replace(',', '.')) || 0
  const isGratuito = numVal === 0

  async function saveValor(valor: number) {
    setSaving(true)
    const { error } = await supabase
      .from('appointments')
      .update({ valor_cobrado: valor })
      .eq('id', appointmentId)
    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar valor', { description: error.message })
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function handleChange(val: string) {
    setDraft(val)
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const n = parseFloat(val.replace(',', '.'))
    if (!isNaN(n) && n >= 0) {
      saveTimer.current = setTimeout(() => saveValor(n), 800)
    }
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const n = parseFloat(draft.replace(',', '.'))
    const finalVal = isNaN(n) ? 0 : Math.max(0, n)
    setDraft(String(finalVal))
    saveValor(finalVal)
  }

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Icon name="dollar" className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Valor do atendimento</h3>
          <p className="text-xs text-slate-400">Definido pela profissional — vai para o pagamento</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft}
            onChange={e => handleChange(e.target.value)}
            onBlur={handleBlur}
            className="input w-full pl-9 text-sm font-semibold"
            placeholder="0,00"
          />
        </div>

        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {saving && <Icon name="loader" className="w-4 h-4 text-slate-400 animate-spin" />}
          {saved && !saving && <Icon name="check" className="w-4 h-4 text-emerald-500" />}
        </div>
      </div>

      {/* Indicadores */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        {procedurePrice != null && procedurePrice > 0 && (
          <p className="text-xs text-slate-400">
            Preço do procedimento: {fmt(procedurePrice)}
          </p>
        )}
        {isGratuito ? (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
            ✓ Sem cobrança (não gera dívida)
          </span>
        ) : numVal !== (procedurePrice ?? 0) && procedurePrice != null ? (
          <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
            ✎ Valor personalizado
          </span>
        ) : null}
      </div>
    </div>
  )
}
