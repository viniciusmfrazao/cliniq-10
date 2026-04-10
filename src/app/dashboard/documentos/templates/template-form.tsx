'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Props = {
  clinicId: string
  template?: {
    id: string
    name: string
    description: string | null
    content: string
    category: string
  }
}

const VARIABLES = [
  { key: '{{PACIENTE_NOME}}', label: 'Nome do paciente' },
  { key: '{{PACIENTE_CPF}}', label: 'CPF do paciente' },
  { key: '{{PACIENTE_EMAIL}}', label: 'Email do paciente' },
  { key: '{{PACIENTE_TELEFONE}}', label: 'Telefone do paciente' },
  { key: '{{DATA}}', label: 'Data atual' },
  { key: '{{HORA}}', label: 'Hora atual' },
  { key: '{{CLINICA_NOME}}', label: 'Nome da clinica' },
  { key: '{{PROCEDIMENTO}}', label: 'Nome do procedimento' },
]

export default function TemplateForm({ clinicId, template }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    content: template?.content || '',
    category: template?.category || 'termo',
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (template) {
        await supabase
          .from('document_templates')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', template.id)
      } else {
        await supabase
          .from('document_templates')
          .insert({ ...form, clinic_id: clinicId })
      }

      router.push('/dashboard/documentos/templates')
      router.refresh()
    } catch {
      alert('Erro ao salvar template')
    } finally {
      setLoading(false)
    }
  }

  const insertVariable = (variable: string) => {
    setForm({ ...form, content: form.content + variable })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do template *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
            placeholder="Ex: Termo de Consentimento - Botox"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Descricao</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
            placeholder="Breve descricao do documento"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoria</label>
          <select
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
          >
            <option value="termo">Termo de consentimento</option>
            <option value="contrato">Contrato</option>
            <option value="autorizacao">Autorizacao</option>
            <option value="orcamento">Orcamento</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Conteudo do documento *</label>
          <div className="mb-2">
            <p className="text-xs text-slate-500 mb-2">Clique para inserir variaveis:</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  title={v.label}
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all resize-none font-mono text-sm"
            rows={15}
            placeholder="Digite o conteudo do documento aqui..."
            required
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary flex-1"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <>
              <Icon name="check" className="w-4 h-4" />
              {template ? 'Salvar' : 'Criar template'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
