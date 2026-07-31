'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Banco = {
  id: string
  nome: string
  ativo: boolean
}

export default function BancosForm({ clinicId, initialBancos }: { clinicId: string; initialBancos: Banco[] }) {
  const supabase = createClient()
  const [bancos, setBancos] = useState<Banco[]>(initialBancos)
  const [novoNome, setNovoNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const nome = novoNome.trim()
    if (!nome) return
    if (bancos.some(b => b.nome.toLowerCase() === nome.toLowerCase())) {
      alert('Já existe um banco cadastrado com esse nome')
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('contas_bancarias')
      .insert({ clinic_id: clinicId, nome })
      .select()
      .single()
    setSaving(false)

    if (error) { alert('Erro ao cadastrar: ' + error.message); return }
    setBancos(prev => [...prev, data as Banco].sort((a, b) => a.nome.localeCompare(b.nome)))
    setNovoNome('')
  }

  async function toggleAtivo(banco: Banco) {
    setBusyId(banco.id)
    const { error } = await supabase
      .from('contas_bancarias')
      .update({ ativo: !banco.ativo })
      .eq('id', banco.id)
    setBusyId(null)

    if (error) { alert('Erro ao atualizar: ' + error.message); return }
    setBancos(prev => prev.map(b => b.id === banco.id ? { ...b, ativo: !b.ativo } : b))
  }

  async function handleDelete(banco: Banco) {
    if (!confirm(`Excluir "${banco.nome}"? Saídas já lançadas com esse banco não serão afetadas.`)) return
    setBusyId(banco.id)
    const { error } = await supabase.from('contas_bancarias').delete().eq('id', banco.id)
    setBusyId(null)

    if (error) { alert('Erro ao excluir: ' + error.message); return }
    setBancos(prev => prev.filter(b => b.id !== banco.id))
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        💡 Os bancos cadastrados aqui aparecem no campo "Banco" ao lançar uma saída, evitando que o mesmo banco
        fique escrito de formas diferentes em cada lançamento.
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Icon name="creditCard" className="w-5 h-5 text-slate-400" />
          Novo banco / conta
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            placeholder="Ex: Nubank, Itaú PJ, Caixa Física..."
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={saving || !novoNome.trim()}
            className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Icon name="plus" className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {bancos.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">Nenhum banco cadastrado ainda.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {bancos.map(banco => (
              <div key={banco.id} className="flex items-center justify-between px-6 py-4 gap-4">
                <span className={`text-sm font-medium ${banco.ativo ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                  {banco.nome}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAtivo(banco)}
                    disabled={busyId === banco.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    {banco.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(banco)}
                    disabled={busyId === banco.id}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-50"
                    title="Excluir"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
