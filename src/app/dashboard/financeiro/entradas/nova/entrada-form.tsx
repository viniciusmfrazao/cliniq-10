'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

function PacienteBusca({ pacientes, onSelect }: { pacientes: { id: string; name: string }[], onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.length > 0
    ? pacientes.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  function pick(p: { id: string; name: string }) {
    setSelected(p.name)
    setQuery(p.name)
    setOpen(false)
    onSelect(p.id)
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onSelect('') }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Digite o nome do paciente..."
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} type="button" onMouseDown={() => pick(p)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
import { createClient } from '@/lib/supabase/client'
import { todayBR } from '@/lib/datetime'
import { parseSupabaseError } from '@/lib/error-messages'


type Props = {
  pacientes: { id: string; name: string }[]
  procedimentos: { id: string; name: string; price: number }[]
  profissionais: { id: string; name: string }[]
  clinicId: string
  userId: string
}

const FORMAS = [
  'Pix', 'Dinheiro', 'Débito', 
  'Crédito 1x', 'Crédito 2x', 'Crédito 3x', 'Crédito 4x', 'Crédito 5x', 'Crédito 6x',
  'Crédito 7x', 'Crédito 8x', 'Crédito 9x', 'Crédito 10x', 'Crédito 11x', 'Crédito 12x'
]

const BANDEIRAS = ['Visa', 'Mastercard', 'Amex, Elo, outros']

const TAXAS: Record<string, number> = {
  'Pix': 0,
  'Dinheiro': 0,
  'Débito': 1.5,
  'Crédito 1x': 3.5,
  'Crédito 2x': 5.0,
  'Crédito 3x': 6.5,
  'Crédito 4x': 7.5,
  'Crédito 5x': 8.5,
  'Crédito 6x': 9.5,
  'Crédito 7x': 10.5,
  'Crédito 8x': 11.5,
  'Crédito 9x': 12.5,
  'Crédito 10x': 13.5,
  'Crédito 11x': 14.5,
  'Crédito 12x': 15.5,
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function EntradaForm({ pacientes, procedimentos, profissionais, clinicId, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [dataVenda, setDataVenda] = useState(todayBR())
  const [pacienteId, setPacienteId] = useState('')
  const [pacienteNome, setPacienteNome] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [procedimentoNome, setProcedimentoNome] = useState('')
  const [selectedProcs, setSelectedProcs] = useState<Array<{ id: string; name: string; price: number }>>([])
  const [profissionalId, setProfissionalId] = useState('')
  const [profissionalNome, setProfissionalNome] = useState('')
  const [forma, setForma] = useState('Pix')
  const [bandeira, setBandeira] = useState('')
  const [valorBruto, setValorBruto] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const taxaPct = TAXAS[forma] || 0
  const valorNum = parseFloat(valorBruto) || 0
  const valorTaxa = valorNum * (taxaPct / 100)
  const valorLiquido = valorNum - valorTaxa
  const showBandeira = forma.startsWith('Crédito') || forma === 'Débito'
  const nParcelas = forma.match(/(\d+)x/) ? parseInt(forma.match(/(\d+)x/)![1]) : 1

  function handlePacienteChange(id: string) {
    setPacienteId(id)
    const pac = pacientes.find(p => p.id === id)
    setPacienteNome(pac?.name || '')
  }

  function handleProcedimentoChange(id: string) {
    if (!id) return
    const proc = procedimentos.find(p => p.id === id)
    if (!proc) return
    // Toggle: se já está na lista, remove; se não, adiciona
    setSelectedProcs(prev => {
      const exists = prev.find(p => p.id === id)
      if (exists) return prev.filter(p => p.id !== id)
      const next = [...prev, { id: proc.id, name: proc.name, price: proc.price }]
      // Atualizar valor bruto como soma de todos
      const total = next.reduce((s, p) => s + p.price, 0)
      setValorBruto(total.toString())
      // Manter compatibilidade com campo único (primeiro proc)
      setProcedimentoId(next[0]?.id || '')
      setProcedimentoNome(next.map(p => p.name).join(', '))
      return next
    })
  }

  function removeProc(id: string) {
    setSelectedProcs(prev => {
      const next = prev.filter(p => p.id !== id)
      const total = next.reduce((s, p) => s + p.price, 0)
      if (total > 0) setValorBruto(total.toString())
      setProcedimentoId(next[0]?.id || '')
      setProcedimentoNome(next.map(p => p.name).join(', '))
      return next
    })
  }

  function handleProfissionalChange(id: string) {
    setProfissionalId(id)
    const prof = profissionais.find(p => p.id === id)
    setProfissionalNome(prof?.name || '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valorBruto || valorNum <= 0) {
      alert('Informe o valor')
      return
    }
    
    setLoading(true)

    const { error } = await supabase.from('entradas').insert({
      clinic_id: clinicId,
      data_venda: dataVenda,
      paciente_id: pacienteId || null,
      paciente_nome: pacienteNome || null,
      procedimento_id: procedimentoId || null,
      procedimento_nome: procedimentoNome || null,
      profissional_id: profissionalId || null,
      profissional_nome: profissionalNome || null,
      forma_pagamento: forma,
      bandeira: showBandeira ? bandeira : null,
      valor_bruto: valorNum,
      taxa_percentual: taxaPct,
      valor_taxa: valorTaxa,
      valor_liquido: valorLiquido,
      n_parcelas: nParcelas,
      observacoes: observacoes || null,
      created_by: userId,
    })

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/financeiro/entradas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Icon name="clipboard" className="w-5 h-5 text-slate-400" />
          Dados do atendimento
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
            <input
              type="date"
              value={dataVenda}
              onChange={e => setDataVenda(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
            <PacienteBusca pacientes={pacientes} onSelect={handlePacienteChange} />
          </div>
        </div>

        {!pacienteId && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ou digite o nome manualmente</label>
            <input
              type="text"
              value={pacienteNome}
              onChange={e => setPacienteNome(e.target.value)}
              placeholder="Nome do paciente"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Procedimento(s)</label>
            <select
              value=""
              onChange={e => handleProcedimentoChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">+ Adicionar procedimento</option>
              {procedimentos.map(p => (
                <option key={p.id} value={p.id}
                  disabled={selectedProcs.some(s => s.id === p.id)}>
                  {selectedProcs.some(s => s.id === p.id) ? '✓ ' : ''}{p.name} - {fmt(p.price)}
                </option>
              ))}
            </select>
            {selectedProcs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedProcs.map(p => (
                  <div key={p.id} className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                    <span className="text-xs text-emerald-800 font-medium">{p.name}</span>
                    <span className="text-xs text-emerald-600">{fmt(p.price)}</span>
                    <button type="button" onClick={() => removeProc(p.id)}
                      className="ml-1 text-emerald-500 hover:text-red-500 text-xs font-bold">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Profissional *</label>
            <select
              value={profissionalId}
              onChange={e => handleProfissionalChange(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Selecione</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            placeholder="Observações opcionais..."
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Icon name="creditCard" className="w-5 h-5 text-slate-400" />
          Pagamento
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Forma de pagamento *</label>
            <select
              value={forma}
              onChange={e => setForma(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {FORMAS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {showBandeira && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bandeira</label>
              <select
                value={bandeira}
                onChange={e => setBandeira(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Selecione</option>
                {BANDEIRAS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valorBruto}
            onChange={e => setValorBruto(e.target.value)}
            required
            placeholder="0,00"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-lg font-semibold"
          />
        </div>

        {valorNum > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Taxa ({forma})</span>
              <span className="font-medium text-slate-900">{taxaPct}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Valor da taxa</span>
              <span className="font-medium text-rose-600">-{fmt(valorTaxa)}</span>
            </div>
            <div className="flex justify-between text-lg border-t border-slate-200 pt-2 mt-2">
              <span className="font-semibold text-slate-900">Valor líquido</span>
              <span className="font-bold text-emerald-600">{fmt(valorLiquido)}</span>
            </div>
            {nParcelas > 1 && (
              <p className="text-xs text-slate-500 mt-2">
                * Pagamento em {nParcelas}x
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Icon name="loader" className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Icon name="check" className="w-5 h-5" />
              Lançar Entrada
            </>
          )}
        </button>
      </div>
    </form>
  )
}

