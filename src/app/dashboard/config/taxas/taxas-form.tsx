'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Taxa = {
  id: string
  forma: string
  bandeira: string
  taxa_percentual: number
}

const FORMAS = [
  { key: 'pix', label: 'Pix' },
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'debito', label: 'Débito' },
  { key: 'credito_1x', label: 'Crédito 1x' },
  { key: 'credito_2x', label: 'Crédito 2x' },
  { key: 'credito_3x', label: 'Crédito 3x' },
  { key: 'credito_4x', label: 'Crédito 4x' },
  { key: 'credito_5x', label: 'Crédito 5x' },
  { key: 'credito_6x', label: 'Crédito 6x' },
  { key: 'credito_7x', label: 'Crédito 7x' },
  { key: 'credito_8x', label: 'Crédito 8x' },
  { key: 'credito_9x', label: 'Crédito 9x' },
  { key: 'credito_10x', label: 'Crédito 10x' },
  { key: 'credito_11x', label: 'Crédito 11x' },
  { key: 'credito_12x', label: 'Crédito 12x' },
]

const BANDEIRAS = [
  { key: 'visa', label: 'Visa' },
  { key: 'master', label: 'Mastercard' },
  { key: 'elo', label: 'Elo' },
  { key: 'amex', label: 'American Express' },
  { key: 'hipercard', label: 'Hipercard' },
]

export default function TaxasForm({ clinicId, initialTaxas }: { clinicId: string; initialTaxas: Taxa[] }) {
  const supabase = createClient()
  const [taxas, setTaxas] = useState<Record<string, number>>(
    Object.fromEntries(initialTaxas.map(t => [`${t.forma}__${t.bandeira}`, t.taxa_percentual]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [bandeira, setBandeira] = useState('visa')

  function getTaxa(forma: string) {
    return taxas[`${forma}__${bandeira}`] ?? 0
  }

  function setTaxa(forma: string, valor: number) {
    setTaxas(p => ({ ...p, [`${forma}__${bandeira}`]: valor }))
  }

  async function handleSave() {
    setSaving(true)
    const rows = Object.entries(taxas).map(([key, taxa_percentual]) => {
      const [forma, band] = key.split('__')
      return { clinic_id: clinicId, forma, bandeira: band || 'visa', taxa_percentual }
    })

    const { error } = await supabase
      .from('taxas_pagamento')
      .upsert(rows, { onConflict: 'clinic_id,forma,bandeira' })

    if (error) alert('Erro ao salvar: ' + error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        💡 As taxas são usadas para calcular o valor líquido nas entradas financeiras.
        Configure por bandeira se suas taxas variam.
      </div>

      {/* Seletor de bandeira */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Bandeira</label>
        <div className="flex flex-wrap gap-2">
          {BANDEIRAS.map(b => (
            <button key={b.key} onClick={() => setBandeira(b.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                bandeira === b.key
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de taxas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div>Forma de pagamento</div>
          <div>Taxa (%)</div>
        </div>
        {FORMAS.map((forma, i) => (
          <div key={forma.key}
            className={`grid grid-cols-2 items-center px-4 py-3 ${i < FORMAS.length - 1 ? 'border-b border-slate-100' : ''}`}>
            <div className="text-sm font-medium text-slate-800">{forma.label}</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={getTaxa(forma.key)}
                onChange={e => setTaxa(forma.key, parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
              <span className="text-sm text-slate-500">%</span>
              {getTaxa(forma.key) > 0 && (
                <span className="text-xs text-slate-400">
                  = R$ {(getTaxa(forma.key)).toFixed(2)} em R$ 100,00
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end items-center gap-3">
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Salvo!</span>}
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {saving ? 'Salvando...' : 'Salvar taxas'}
        </button>
      </div>
    </div>
  )
}


