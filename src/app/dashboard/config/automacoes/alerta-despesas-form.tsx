'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Props = {
  clinicId: string
  initial: {
    enabled: boolean
    diasAntes: number
    temTelefones: boolean
  }
}

const OPCOES_DIAS = [
  { value: 0, label: 'Só no dia do vencimento' },
  { value: 7, label: 'No dia + 7 dias antes' },
]

export default function AlertaDespesasForm({ clinicId, initial }: Props) {
  const toast = useToast()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [diasAntes, setDiasAntes] = useState(initial.diasAntes)
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    try {
      const res = await fetch('/api/config/alerta-despesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, diasAntes }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Configuração salva!')
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-700">Ativar alerta de despesas</p>
          <p className="text-sm text-slate-500">
            Envia mensagem para os números do relatório semanal quando há boletos vencendo
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(v => !v)}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
            enabled ? 'bg-violet-500' : 'bg-slate-200'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Horário de envio */}
      <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
        <span>🕗</span>
        <span>Enviado automaticamente todo dia às <strong className="text-slate-700">08:00</strong> da manhã</span>
      </div>

      {/* Quando alertar */}
      {enabled && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">Quando alertar?</p>
          <div className="space-y-2">
            {OPCOES_DIAS.map(op => (
              <label key={op.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                diasAntes === op.value
                  ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="radio"
                  name="dias_antes"
                  value={op.value}
                  checked={diasAntes === op.value}
                  onChange={() => setDiasAntes(op.value)}
                  className="accent-violet-500"
                />
                <span className="text-sm text-slate-700">{op.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Aviso sem telefones */}
      {enabled && !initial.temTelefones && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          ⚠️ Nenhum telefone configurado no relatório semanal. Configure os telefones de destino
          no campo "Telefones do relatório" para receber os alertas.
        </div>
      )}

      {/* Salvar */}
      <div className="flex justify-end">
        <button
          onClick={salvar}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? <LoadingSpinner size="sm" /> : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
