'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Template = {
  id: string
  name: string
  description: string | null
  category: string
  is_active: boolean
  created_at: string
}

export default function TemplatesList({ templates: initial, clinicId }: { templates: Template[]; clinicId: string }) {
  const [templates, setTemplates] = useState(initial)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase
      .from('document_templates')
      .update({ is_active: !isActive })
      .eq('id', id)

    setTemplates(templates.map(t => 
      t.id === id ? { ...t, is_active: !isActive } : t
    ))
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return

    await supabase.from('document_templates').delete().eq('id', id)
    setTemplates(templates.filter(t => t.id !== id))
  }

  if (templates.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Icon name="file" className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-600 font-medium mb-2">Nenhum template criado</p>
        <p className="text-sm text-slate-400 mb-4">Crie modelos de documentos para enviar aos pacientes</p>
        <Link href="/dashboard/documentos/templates/novo" className="btn-primary w-auto px-6 inline-flex items-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          Criar template
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {templates.map(template => (
        <div key={template.id} className={`card p-4 ${!template.is_active ? 'opacity-50' : ''}`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0">
              <Icon name="file" className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate">{template.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                  {template.category}
                </span>
              </div>
              {template.description && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{template.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/documentos/templates/${template.id}`}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Icon name="edit" className="w-4 h-4 text-slate-600" />
              </Link>
              <button
                onClick={() => toggleActive(template.id, template.is_active)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={template.is_active ? 'Desativar' : 'Ativar'}
              >
                <Icon 
                  name={template.is_active ? 'eye' : 'eyeOff'} 
                  className={`w-4 h-4 ${template.is_active ? 'text-emerald-600' : 'text-slate-400'}`} 
                />
              </button>
              <button
                onClick={() => deleteTemplate(template.id)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                title="Excluir"
              >
                <Icon name="trash" className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
