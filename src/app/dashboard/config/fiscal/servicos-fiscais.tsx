'use client'

import { useEffect, useState } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

type ServicoFiscal = {
  id: string
  nome: string
  descricao_servico: string | null
  item_lista_servico: string
  codigo_tributario_municipio: string | null
  codigo_nbs: string | null
  ibs_cbs_classificacao_tributaria: string | null
  ibs_cbs_situacao_tributaria: string | null
  codigo_indicador_operacao: string | null
  is_default: boolean
}

const VAZIO = {
  nome: '', descricao_servico: '', item_lista_servico: '', codigo_tributario_municipio: '',
  codigo_nbs: '', ibs_cbs_classificacao_tributaria: '', ibs_cbs_situacao_tributaria: '',
  codigo_indicador_operacao: '', is_default: false,
}

export default function ServicosFiscais() {
  const toast = useToast()
  const [servicos, setServicos] = useState<ServicoFiscal[] | null>(null)
  const [editando, setEditando] = useState<string | null>(null) // id, ou 'novo'
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    try {
      const res = await fetch('/api/config/fiscal/servicos')
      const data = await res.json()
      setServicos(data.servicos || [])
    } catch {
      setServicos([])
    }
  }

  useEffect(() => { carregar() }, [])

  function abrirEdicao(s?: ServicoFiscal) {
    if (s) {
      setForm({
        nome: s.nome, descricao_servico: s.descricao_servico || '',
        item_lista_servico: s.item_lista_servico,
        codigo_tributario_municipio: s.codigo_tributario_municipio || '',
        codigo_nbs: s.codigo_nbs || '',
        ibs_cbs_classificacao_tributaria: s.ibs_cbs_classificacao_tributaria || '',
        ibs_cbs_situacao_tributaria: s.ibs_cbs_situacao_tributaria || '',
        codigo_indicador_operacao: s.codigo_indicador_operacao || '',
        is_default: s.is_default,
      })
      setEditando(s.id)
    } else {
      setForm(VAZIO)
      setEditando('novo')
    }
  }

  async function salvar() {
    if (!form.nome || !form.item_lista_servico) {
      toast.error('Preencha ao menos Nome e Item de Serviço (LC116)')
      return
    }
    setSalvando(true)
    try {
      const url = editando === 'novo' ? '/api/config/fiscal/servicos' : `/api/config/fiscal/servicos/${editando}`
      const method = editando === 'novo' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Erro ao salvar', { description: data.error })
        return
      }
      toast.success('Serviço fiscal salvo')
      setEditando(null)
      carregar()
    } catch (err) {
      toast.error('Erro ao salvar', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Remover este serviço fiscal? Notas já emitidas com ele não são afetadas.')) return
    try {
      const res = await fetch(`/api/config/fiscal/servicos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error('Erro ao remover', { description: data.error })
        return
      }
      toast.success('Removido')
      carregar()
    } catch (err) {
      toast.error('Erro ao remover', { description: err instanceof Error ? err.message : undefined })
    }
  }

  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-bold text-slate-900">Serviços fiscais (por CNAE)</h2>
        {editando === null && (
          <button onClick={() => abrirEdicao()} className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
            + Adicionar serviço
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Se a clínica presta mais de um tipo de serviço (ex: fisioterapia + estética), cada um
        pode ter sua própria classificação tributária. Na hora de emitir a nota, você escolhe
        qual serviço se aplica. Com um serviço só (ou nenhum cadastrado), a emissão usa os
        campos de tributação lá em cima, sem pedir escolha.
      </p>

      {servicos === null && (
        <div className="flex items-center gap-2 text-sm text-slate-400"><LoadingSpinner size="sm" /> Carregando...</div>
      )}

      {servicos !== null && servicos.length === 0 && editando === null && (
        <p className="text-sm text-slate-400 italic">Nenhum serviço fiscal específico cadastrado ainda.</p>
      )}

      {servicos !== null && servicos.length > 0 && (
        <div className="space-y-2 mb-3">
          {servicos.map(s => (
            <div key={s.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {s.nome} {s.is_default && <span className="ml-2 text-xs font-normal text-emerald-600">(padrão)</span>}
                </p>
                <p className="text-xs text-slate-400">
                  Item {s.item_lista_servico}
                  {s.codigo_tributario_municipio ? ` • CTISS ${s.codigo_tributario_municipio}` : ''}
                  {s.codigo_nbs ? ` • NBS ${s.codigo_nbs}` : ''}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => abrirEdicao(s)} className="text-xs text-slate-500 hover:text-slate-700">Editar</button>
                <button onClick={() => excluir(s.id)} className="text-xs text-rose-500 hover:text-rose-700">Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando !== null && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nome (ex: Fisioterapia, Estética) *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Item de Serviço (LC116) *</label>
              <input value={form.item_lista_servico} onChange={e => setForm(f => ({ ...f, item_lista_servico: e.target.value }))}
                placeholder="ex: 0408" className="input w-full text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descrição do serviço (aparece na nota)</label>
            <input value={form.descricao_servico} onChange={e => setForm(f => ({ ...f, descricao_servico: e.target.value }))} className="input w-full text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">CTISS / código tributário do município</label>
              <input value={form.codigo_tributario_municipio} onChange={e => setForm(f => ({ ...f, codigo_tributario_municipio: e.target.value }))} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Código NBS</label>
              <input value={form.codigo_nbs} onChange={e => setForm(f => ({ ...f, codigo_nbs: e.target.value }))} className="input w-full text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">cIndOp</label>
              <input value={form.codigo_indicador_operacao} onChange={e => setForm(f => ({ ...f, codigo_indicador_operacao: e.target.value }))} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">CST (IBS/CBS)</label>
              <input value={form.ibs_cbs_situacao_tributaria} onChange={e => setForm(f => ({ ...f, ibs_cbs_situacao_tributaria: e.target.value }))} className="input w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">cClassTrib</label>
              <input value={form.ibs_cbs_classificacao_tributaria} onChange={e => setForm(f => ({ ...f, ibs_cbs_classificacao_tributaria: e.target.value }))} className="input w-full text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
            Usar como padrão (pré-selecionado ao emitir)
          </label>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditando(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white">
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
