'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/ui/Icon'
import { todayBR } from '@/lib/datetime'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Entrada = {
  id: string
  data_venda: string
  paciente_nome: string
  procedimento_nome: string
  profissional_nome: string
  profissional_id: string | null
  forma_pagamento: string
  bandeira: string | null
  valor_bruto: number
  valor_liquido: number
  taxa_percentual: number
  tipo_receita?: string
  nota_fiscal_status?: string | null
  nota_fiscal_numero?: string | null
  nota_fiscal_url_pdf?: string | null
  nota_fiscal_erro?: string | null
}

type ComissaoConfig = {
  id: string
  recebe_comissao: boolean
  comissao_percentual: number | null
}

type Props = {
  entradas: Entrada[]
  pacientes: { id: string; name: string }[]
  procedimentos: { id: string; name: string; price: number }[]
  profissionais: { id: string; name: string }[]
  clinicId: string
  comissaoAtiva?: boolean
  comissaoConfig?: ComissaoConfig[]
  nfseAtivo?: boolean
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function primeiroDiaMes() {
  return todayBR().slice(0, 7) + '-01'
}
function ultimoDiaMes() {
  const hoje = todayBR()
  const [y, m] = hoje.slice(0, 7).split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`
}

const FORMAS = ['pix', 'dinheiro', 'credito', 'debito']
const FORMA_LABEL: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' }

function EditEntradaModal({
  entrada,
  onSave,
  onClose,
}: {
  entrada: Entrada
  onSave: (updated: Entrada) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState(entrada.data_venda)
  const [paciente, setPaciente] = useState(entrada.paciente_nome || '')
  const [procedimento, setProcedimento] = useState(entrada.procedimento_nome || '')
  const [profissional, setProfissional] = useState(entrada.profissional_nome || '')
  const [forma, setForma] = useState(entrada.forma_pagamento || 'pix')
  const [bandeira, setBandeira] = useState(entrada.bandeira || '')
  const [bruto, setBruto] = useState(String(entrada.valor_bruto || ''))
  const [liquido, setLiquido] = useState(String(entrada.valor_liquido || ''))
  const [tipoReceita, setTipoReceita] = useState<'servico' | 'produto'>(
    entrada.tipo_receita === 'produto' ? 'produto' : 'servico'
  )

  // Ao mudar bruto, recalcula liquido mantendo mesma taxa
  function handleBrutoChange(val: string) {
    setBruto(val)
    const vb = parseFloat(val) || 0
    const taxa = Number(entrada.taxa_percentual) || 0
    // taxa pode estar em % (ex: 2) ou decimal (0.02) — preservamos a lógica existente
    const liq = taxa > 1
      ? Math.round(vb * (1 - taxa / 100) * 100) / 100
      : Math.round(vb * (1 - taxa) * 100) / 100
    setLiquido(String(liq))
  }

  async function handleSave() {
    const vb = parseFloat(bruto) || 0
    const vl = parseFloat(liquido) || 0
    if (vb <= 0) { toast.error('Valor bruto deve ser maior que zero'); return }

    setSaving(true)
    const { error } = await supabase.from('entradas').update({
      data_venda: data,
      paciente_nome: paciente,
      procedimento_nome: procedimento,
      profissional_nome: profissional,
      forma_pagamento: forma,
      bandeira: bandeira || null,
      valor_bruto: vb,
      valor_liquido: vl,
      valor_taxa: Math.round((vb - vl) * 100) / 100,
      tipo_receita: tipoReceita,
    }).eq('id', entrada.id)
    setSaving(false)

    if (error) {
      toast.error('Erro ao salvar', { description: error.message })
      return
    }

    toast.success('Entrada atualizada')
    onSave({ ...entrada, data_venda: data, paciente_nome: paciente, procedimento_nome: procedimento, profissional_nome: profissional, forma_pagamento: forma, bandeira: bandeira || null, valor_bruto: vb, valor_liquido: vl, tipo_receita: tipoReceita })
    onClose()
  }

  const modal = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900">Editar Entrada</h2>
            <p className="text-sm text-slate-500 mt-0.5">{entrada.paciente_nome}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <Icon name="x" className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Forma de pagamento</label>
              <select value={forma} onChange={e => setForma(e.target.value)} className="input w-full text-sm">
                {FORMAS.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
              </select>
            </div>
          </div>

          {(forma === 'credito' || forma === 'debito') && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bandeira</label>
              <input type="text" value={bandeira} onChange={e => setBandeira(e.target.value)} placeholder="Ex: Visa, Mastercard" className="input w-full text-sm" />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Paciente</label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} className="input w-full text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tipo de receita</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTipoReceita('servico')}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                  tipoReceita === 'servico'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                Serviço
              </button>
              <button type="button" onClick={() => setTipoReceita('produto')}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                  tipoReceita === 'produto'
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                Produto
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Procedimento</label>
            <input type="text" value={procedimento} onChange={e => setProcedimento(e.target.value)} className="input w-full text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Profissional</label>
            <input type="text" value={profissional} onChange={e => setProfissional(e.target.value)} className="input w-full text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Valor bruto (R$)</label>
              <input type="number" min={0} step={0.01} value={bruto}
                onChange={e => handleBrutoChange(e.target.value)}
                className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Valor líquido (R$)</label>
              <input type="number" min={0} step={0.01} value={liquido}
                onChange={e => setLiquido(e.target.value)}
                className="input w-full text-sm" />
              <p className="text-xs text-slate-400 mt-1">Ajuste manualmente se necessário</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default function EntradasList({ entradas, procedimentos, profissionais, clinicId, comissaoAtiva = false, comissaoConfig = [], nfseAtivo = false }: Props) {
  const [list, setList] = useState(entradas)
  const comissaoMap = new Map(comissaoConfig.map(c => [c.id, c]))

  function comissaoDoProfissional(profissionalId: string | null) {
    if (!comissaoAtiva || !profissionalId) return null
    const cfg = comissaoMap.get(profissionalId)
    if (!cfg?.recebe_comissao || cfg.comissao_percentual == null) return null
    return cfg.comissao_percentual
  }
  const [search, setSearch] = useState('')
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes())
  const [dataFim, setDataFim] = useState(ultimoDiaMes())
  const [filtroProfissional, setFiltroProfissional] = useState('')
  const [filtroProcedimento, setFiltroProcedimento] = useState('')
  const [filtroForma, setFiltroForma] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<Entrada | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const toast = useToast()

  async function buscar() {
    startTransition(async () => {
      const params = new URLSearchParams()
      if (dataInicio) params.set('data_inicio', dataInicio)
      if (dataFim) params.set('data_fim', dataFim)
      const res = await fetch(`/api/financeiro/entradas?${params}`)
      if (!res.ok) {
        toast.error('Erro ao buscar entradas')
        return
      }
      const { data } = await res.json()
      setList(data || [])
    })
  }

  const filteredList = list.filter(e =>
    (!search ||
      e.paciente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      e.procedimento_nome?.toLowerCase().includes(search.toLowerCase()) ||
      e.profissional_nome?.toLowerCase().includes(search.toLowerCase())) &&
    (!filtroProfissional || e.profissional_id === filtroProfissional) &&
    // procedimento_nome pode vir combinado ("Botox + Preenchimento") quando o pagamento
    // cobriu mais de um procedimento — por isso o match é por substring do nome, não igualdade.
    (!filtroProcedimento || e.procedimento_nome?.toLowerCase().includes(filtroProcedimento.toLowerCase())) &&
    (!filtroForma || e.forma_pagamento === filtroForma)
  )

  const totalBruto = filteredList.reduce((s, e) => s + Number(e.valor_bruto || 0), 0)
  const totalLiquido = filteredList.reduce((s, e) => s + Number(e.valor_liquido || 0), 0)
  const totalTaxas = totalBruto - totalLiquido

  const totalComissao = filteredList.reduce((s, e) => {
    const pct = comissaoDoProfissional(e.profissional_id)
    if (pct == null) return s
    return s + Number(e.valor_bruto || 0) * (pct / 100)
  }, 0)

  const porProcedimento = filteredList.reduce((acc, e) => {
    const proc = e.procedimento_nome || 'Sem procedimento'
    if (!acc[proc]) acc[proc] = { valor: 0, qtd: 0 }
    acc[proc].valor += Number(e.valor_bruto || 0)
    acc[proc].qtd += 1
    return acc
  }, {} as Record<string, { valor: number; qtd: number }>)

  async function handleDelete(id: string) {
    const removed = list.find(e => e.id === id)
    if (!removed) return

    setList(prev => prev.filter(e => e.id !== id))

    let undone = false
    toast.undo({
      title: 'Entrada removida',
      description: 'Você tem 5s para desfazer',
      duration: 5000,
      onUndo: () => {
        undone = true
        setList(prev => [...prev, removed].sort(
          (a, b) => (b.data_venda || '').localeCompare(a.data_venda || '')
        ))
      },
    })

    setTimeout(async () => {
      if (undone) return
      setDeleting(id)
      const { error } = await supabase.from('entradas').delete().eq('id', id)
      setDeleting(null)
      if (error) {
        setList(prev => [...prev, removed].sort(
          (a, b) => (b.data_venda || '').localeCompare(a.data_venda || '')
        ))
        toast.error('Erro ao excluir', { description: error.message })
      }
    }, 5200)
  }

  function handleSaveEdit(updated: Entrada) {
    setList(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  const [emitindo, setEmitindo] = useState<string | null>(null)

  async function emitirNota(entradaId: string) {
    setEmitindo(entradaId)
    try {
      const res = await fetch('/api/financeiro/nota-fiscal/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrada_id: entradaId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Erro ao emitir nota', { description: data.error })
        setList(prev => prev.map(e => e.id === entradaId ? { ...e, nota_fiscal_status: 'erro', nota_fiscal_erro: data.error } : e))
        return
      }
      setList(prev => prev.map(e => e.id === entradaId ? { ...e, nota_fiscal_status: 'processando' } : e))
      toast.success('Nota fiscal enviada, aguardando autorização')
      // Consulta automática após alguns segundos (a autorização é assíncrona)
      setTimeout(() => consultarNota(entradaId, true), 6000)
    } catch (err) {
      toast.error('Erro ao emitir nota', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setEmitindo(null)
    }
  }

  async function consultarNota(entradaId: string, silencioso = false) {
    if (!silencioso) setEmitindo(entradaId)
    try {
      const res = await fetch(`/api/financeiro/nota-fiscal/consultar?entrada_id=${entradaId}`)
      const data = await res.json()
      if (!res.ok) {
        if (!silencioso) toast.error('Erro ao consultar nota', { description: data.error })
        return
      }
      if (data.status === 'autorizada') {
        setList(prev => prev.map(e => e.id === entradaId
          ? { ...e, nota_fiscal_status: 'autorizada', nota_fiscal_numero: data.numero, nota_fiscal_url_pdf: data.url_pdf }
          : e))
        if (!silencioso) toast.success('Nota fiscal autorizada')
      } else if (data.status === 'erro') {
        setList(prev => prev.map(e => e.id === entradaId ? { ...e, nota_fiscal_status: 'erro', nota_fiscal_erro: data.erro } : e))
        if (!silencioso) toast.error('Nota fiscal com erro', { description: data.erro })
      } else if (!silencioso) {
        toast.info('Ainda processando, tente novamente em alguns segundos')
      }
    } finally {
      if (!silencioso) setEmitindo(null)
    }
  }

  function NotaFiscalIconButton({ entrada }: { entrada: Entrada }) {
    // Produto: NFe/NFC-e ainda não implementada — ícone desabilitado, só sinaliza o que falta
    if (entrada.tipo_receita === 'produto') {
      return (
        <span title="NFe de produto ainda não implementada"
          className="p-2 text-slate-300 rounded-lg cursor-not-allowed inline-flex">
          <Icon name="box" className="w-4 h-4" />
        </span>
      )
    }

    const status = entrada.nota_fiscal_status || 'nao_emitida'
    const carregando = emitindo === entrada.id

    if (status === 'autorizada') {
      return (
        <a href={entrada.nota_fiscal_url_pdf || undefined} target="_blank" rel="noopener noreferrer"
          title={`NFS-e nº ${entrada.nota_fiscal_numero || '-'} — ver PDF`}
          onClick={e => e.stopPropagation()}
          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition inline-flex">
          <Icon name="receipt" className="w-4 h-4" />
        </a>
      )
    }

    if (status === 'processando') {
      return (
        <button onClick={e => { e.stopPropagation(); consultarNota(entrada.id) }} disabled={carregando}
          title="Processando — clique para atualizar status"
          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition">
          {carregando ? <LoadingSpinner size="sm" /> : <Icon name="loader" className="w-4 h-4" />}
        </button>
      )
    }

    if (status === 'erro') {
      return (
        <button onClick={e => { e.stopPropagation(); emitirNota(entrada.id) }} disabled={carregando}
          title={entrada.nota_fiscal_erro || 'Erro ao emitir — clique para tentar de novo'}
          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition">
          {carregando ? <LoadingSpinner size="sm" /> : <Icon name="x" className="w-4 h-4" />}
        </button>
      )
    }

    return (
      <button onClick={e => { e.stopPropagation(); emitirNota(entrada.id) }} disabled={carregando}
        title="Emitir NFS-e"
        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition">
        {carregando ? <LoadingSpinner size="sm" /> : <Icon name="receipt" className="w-4 h-4" />}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {editEntry && (
        <EditEntradaModal
          entrada={editEntry}
          onSave={handleSaveEdit}
          onClose={() => setEditEntry(null)}
        />
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por paciente, procedimento ou profissional..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Icon name="calendar" className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="bg-transparent text-sm text-slate-700 focus:outline-none w-32" />
              <span className="text-slate-400 text-sm">até</span>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="bg-transparent text-sm text-slate-700 focus:outline-none w-32" />
            </div>
            <button onClick={buscar} disabled={isPending}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-60 text-sm">
              {isPending ? <LoadingSpinner size="sm" /> : <Icon name="search" className="w-4 h-4" />}
              Filtrar
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mt-3">
          <select value={filtroProfissional} onChange={e => setFiltroProfissional(e.target.value)}
            className="input flex-1 text-sm">
            <option value="">Todos os profissionais</option>
            {profissionais.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filtroProcedimento} onChange={e => setFiltroProcedimento(e.target.value)}
            className="input flex-1 text-sm">
            <option value="">Todos os procedimentos</option>
            {procedimentos.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select value={filtroForma} onChange={e => setFiltroForma(e.target.value)}
            className="input flex-1 text-sm">
            <option value="">Todas as formas de pagamento</option>
            {FORMAS.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
          </select>
          {(filtroProfissional || filtroProcedimento || filtroForma || search) && (
            <button
              onClick={() => { setFiltroProfissional(''); setFiltroProcedimento(''); setFiltroForma(''); setSearch('') }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition whitespace-nowrap"
            >
              <Icon name="x" className="w-4 h-4" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Totais */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl">
          <span className="font-medium">Total Bruto:</span> {fmt(totalBruto)}
        </div>
        <div className="bg-violet-50 text-violet-700 px-4 py-2 rounded-xl">
          <span className="font-medium">Total Líquido:</span> {fmt(totalLiquido)}
        </div>
        {totalTaxas > 0 && (
          <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl">
            <span className="font-medium">Taxas:</span> {fmt(totalTaxas)}
          </div>
        )}
        {comissaoAtiva && totalComissao > 0 && (
          <>
            <div className="bg-teal-50 text-teal-700 px-4 py-2 rounded-xl">
              <span className="font-medium">Comissões:</span> {fmt(totalComissao)}
            </div>
            <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl">
              <span className="font-medium">Fica com a clínica:</span> {fmt(totalBruto - totalComissao)}
            </div>
          </>
        )}
        <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl">
          <span className="font-medium">{filteredList.length}</span> registros
        </div>
      </div>

      {/* Por procedimento */}
      {Object.keys(porProcedimento).length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h4 className="font-semibold text-slate-700 mb-3 text-sm flex items-center gap-2">
            <Icon name="clipboard" className="w-4 h-4 text-emerald-600" />
            Por procedimento
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(porProcedimento)
              .sort((a, b) => b[1].valor - a[1].valor)
              .slice(0, 8)
              .map(([proc, data]) => (
              <div key={proc} className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-emerald-600 truncate" title={proc}>{proc}</p>
                <p className="font-bold text-emerald-700">{fmt(data.valor)}</p>
                <p className="text-xs text-emerald-500">{data.qtd} {data.qtd === 1 ? 'atendimento' : 'atendimentos'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Mobile: cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredList.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500">
              {isPending ? 'Buscando...' : 'Nenhuma entrada encontrada'}
            </div>
          ) : filteredList.map(e => (
            <div key={e.id} className="p-4 cursor-pointer" onClick={() => setEditEntry(e)}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{e.paciente_nome || '-'}</p>
                  <p className="text-sm text-slate-500 truncate mt-0.5">{e.procedimento_nome || '-'}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-slate-400">
                      {new Date(e.data_venda + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{e.forma_pagamento}</span>
                    {e.profissional_nome && (
                      <span className="text-xs text-slate-400">{e.profissional_nome}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="font-bold text-emerald-600">{fmt(e.valor_liquido)}</p>
                  <p className="text-xs text-slate-400">{fmt(e.valor_bruto)} bruto</p>
                  {(() => {
                    const pct = comissaoDoProfissional(e.profissional_id)
                    if (pct == null) return null
                    const valorComissao = Number(e.valor_bruto || 0) * (pct / 100)
                    return (
                      <p className="text-xs text-teal-600 mt-0.5">
                        {pct}% = {fmt(valorComissao)} · clínica {fmt(Number(e.valor_bruto || 0) - valorComissao)}
                      </p>
                    )
                  })()}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {nfseAtivo && <NotaFiscalIconButton entrada={e} />}
                    <button onClick={e2 => { e2.stopPropagation(); handleDelete(e.id) }} disabled={deleting === e.id}
                      className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition">
                      <Icon name={deleting === e.id ? 'loader' : 'trash'} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Paciente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Procedimento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Profissional</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Forma</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Bruto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Líquido</th>
                {comissaoAtiva && (
                  <>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-teal-600 uppercase">Profissional</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-indigo-600 uppercase">Clínica</th>
                  </>
                )}
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={comissaoAtiva ? 10 : 8} className="px-4 py-12 text-center text-slate-500">
                    {isPending ? 'Buscando...' : 'Nenhuma entrada encontrada'}
                  </td>
                </tr>
              ) : (
                filteredList.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setEditEntry(e)}>
                    <td className="px-4 py-3 text-sm">
                      {new Date(e.data_venda + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{e.paciente_nome || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{e.procedimento_nome || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{e.profissional_nome || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs">
                        {e.forma_pagamento}
                        {e.bandeira && ` (${e.bandeira})`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{fmt(e.valor_bruto)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="text-emerald-600 font-medium">{fmt(e.valor_liquido)}</span>
                      {e.taxa_percentual > 0 && (
                        <span className="text-xs text-slate-400 ml-1">(-{(e.taxa_percentual * 100).toFixed(1)}%)</span>
                      )}
                    </td>
                    {comissaoAtiva && (() => {
                      const pct = comissaoDoProfissional(e.profissional_id)
                      if (pct == null) return (<><td className="px-4 py-3 text-sm text-right text-slate-300">-</td><td className="px-4 py-3 text-sm text-right text-slate-300">-</td></>)
                      const valorComissao = Number(e.valor_bruto || 0) * (pct / 100)
                      return (
                        <>
                          <td className="px-4 py-3 text-sm text-right text-teal-700 font-medium">
                            {fmt(valorComissao)} <span className="text-xs text-teal-400">({pct}%)</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-indigo-700 font-medium">
                            {fmt(Number(e.valor_bruto || 0) - valorComissao)}
                          </td>
                        </>
                      )
                    })()}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {nfseAtivo && <NotaFiscalIconButton entrada={e} />}
                        <button onClick={e2 => { e2.stopPropagation(); handleDelete(e.id) }} disabled={deleting === e.id}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                          title="Excluir">
                          <Icon name={deleting === e.id ? 'loader' : 'trash'} className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
