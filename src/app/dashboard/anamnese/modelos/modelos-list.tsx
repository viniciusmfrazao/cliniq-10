'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

type Template = {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
  cor_primaria: string
  anamnese_template_fields: { count: number }[]
}

export default function ModelosList({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [creating, setCreating] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { error: toastError, success: toastSuccess } = useToast()

  async function criarModelo() {
    if (!novoNome.trim()) {
      toastError('Digite o nome da ficha')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/anamnese/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar modelo')
      router.push(`/dashboard/anamnese/modelos/${data.template.id}`)
    } catch (e: any) {
      toastError(e.message)
      setSaving(false)
    }
  }

  async function toggleAtivo(t: Template) {
    const novoAtivo = !t.ativo
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, ativo: novoAtivo } : x))
    try {
      const res = await fetch(`/api/anamnese/templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoAtivo }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
    } catch {
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, ativo: t.ativo } : x))
      toastError('Erro ao atualizar modelo')
    }
  }

  async function excluirModelo(t: Template) {
    if (!confirm(`Excluir o modelo "${t.nome}"? Essa ação não pode ser desfeita.`)) return
    try {
      const res = await fetch(`/api/anamnese/templates/${t.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
      setTemplates(prev => prev.filter(x => x.id !== t.id))
      toastSuccess('Modelo excluído')
    } catch (e: any) {
      toastError(e.message)
    }
  }

  const modelosAtivos = templates.filter(t => t.ativo).length

  return (
    <div className="space-y-4">
      {modelosAtivos > 1 && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700 flex items-center gap-2">
          <Icon name="check" className="w-4 h-4 shrink-0" />
          Com {modelosAtivos} modelos ativos, a equipe vai poder escolher qual ficha enviar na hora de mandar pro paciente.
        </div>
      )}

      <div className="card divide-y divide-slate-100">
        {templates.length === 0 && !creating && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Icon name="layers" className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Nenhum modelo criado ainda</h3>
            <p className="text-sm text-slate-500 mb-4">Crie fichas personalizadas além do modelo padrão</p>
          </div>
        )}

        {templates.map(t => (
          <div key={t.id} className="p-4 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: t.cor_primaria }} />
            <div className="flex-1 min-w-0">
              <Link href={`/dashboard/anamnese/modelos/${t.id}`} className="font-semibold text-slate-900 hover:underline">
                {t.nome}
              </Link>
              <p className="text-sm text-slate-500">
                {t.anamnese_template_fields?.[0]?.count ?? 0} perguntas
                {!t.ativo && <span className="ml-2 badge-neutral">Inativo</span>}
              </p>
            </div>
            <button
              onClick={() => toggleAtivo(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                t.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t.ativo ? 'Ativo' : 'Inativo'}
            </button>
            <Link href={`/dashboard/anamnese/modelos/${t.id}`} className="p-2 hover:bg-slate-100 rounded-lg transition">
              <Icon name="edit" className="w-4 h-4 text-slate-500" />
            </Link>
            <button onClick={() => excluirModelo(t)} className="p-2 hover:bg-red-50 rounded-lg transition">
              <Icon name="trash" className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ))}
      </div>

      {creating ? (
        <div className="card p-4 space-y-3">
          <label className="label">Nome da ficha</label>
          <input
            autoFocus
            className="input"
            placeholder="Ex: Ficha de Anamnese Corporal"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && criarModelo()}
          />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving} onClick={criarModelo}>
              {saving ? 'Criando...' : 'Criar e continuar'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setCreating(false); setNovoNome('') }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Icon name="plus" className="w-4 h-4" />
          Novo modelo
        </button>
      )}
    </div>
  )
}
