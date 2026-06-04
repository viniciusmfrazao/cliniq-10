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
    theme_color?: string
    image_url?: string | null
    requires_signature?: boolean
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

const COLOR_PRESETS = [
  { name: 'Dourado Elegante', primary: '#b89a6a', bg: '#f9f5f0', accent: '#d4b98a' },
  { name: 'Rosa Suave', primary: '#d4a5a5', bg: '#fdf5f5', accent: '#e8c4c4' },
  { name: 'Verde Menta', primary: '#6ba89a', bg: '#f0f9f7', accent: '#8ac4b8' },
  { name: 'Azul Serenidade', primary: '#6a9ab8', bg: '#f0f5f9', accent: '#8ab8d4' },
  { name: 'Lilás Delicado', primary: '#9a6ab8', bg: '#f5f0f9', accent: '#b88ad4' },
  { name: 'Coral', primary: '#d4826a', bg: '#fdf8f5', accent: '#e8a88c' },
]

export default function TemplateForm({ clinicId, template }: Props) {
  const router = useRouter()
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>(template?.image_url || '')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    content: template?.content || '',
    image_url: template?.image_url || '' as string,
    requires_signature: template?.requires_signature !== false,
    category: template?.category || 'termo',
    theme_color: template?.theme_color || '#b89a6a',
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.name) {
      alert('Nome é obrigatório')
      return
    }
    
    if (form.category !== 'anamnese' && !form.content) {
      alert('Conteúdo é obrigatório')
      return
    }
    
    setLoading(true)

    try {
      const dataToSave = {
        ...form,
        content: form.category === 'anamnese' ? 'ANAMNESE_FORM' : form.content,
        image_url: form.image_url || null,
        requires_signature: form.requires_signature,
      }
      
      if (template) {
        await supabase
          .from('document_templates')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', template.id)
      } else {
        await supabase
          .from('document_templates')
          .insert({ ...dataToSave, clinic_id: clinicId })
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
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow]"
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
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow]"
            placeholder="Breve descricao do documento"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de documento</label>
          <select
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow]"
          >
            <option value="termo">Termo de consentimento</option>
            <option value="contrato">Contrato</option>
            <option value="autorizacao">Autorizacao</option>
            <option value="orcamento">Orcamento</option>
            <option value="anamnese">Ficha de Anamnese</option>
            <option value="outro">Outro</option>
          </select>
          {form.category === 'anamnese' && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <Icon name="check" className="w-3 h-3" />
              Ficha de anamnese usa formulário interativo especial
            </p>
          )}
        </div>

        {/* Seletor de cores */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Cor do tema</label>
          <div className="grid grid-cols-3 gap-2">
            {COLOR_PRESETS.map(preset => (
              <button
                key={preset.primary}
                type="button"
                onClick={() => setForm({ ...form, theme_color: preset.primary })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  form.theme_color === preset.primary 
                    ? 'border-slate-900 shadow-md' 
                    : 'border-transparent hover:border-slate-200'
                }`}
                style={{ background: preset.bg }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded-full" 
                    style={{ background: preset.primary }}
                  />
                  <span className="text-xs font-medium" style={{ color: preset.primary }}>
                    {preset.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-slate-500">Cor personalizada:</label>
            <input
              type="color"
              value={form.theme_color}
              onChange={e => setForm({ ...form, theme_color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
            <span className="text-xs text-slate-400 font-mono">{form.theme_color}</span>
          </div>
        </div>

        {form.category !== 'anamnese' ? (
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-[border-color,box-shadow] resize-none font-mono text-sm"
              rows={15}
              placeholder="Digite o conteudo do documento aqui..."
              required
            />

            {/* Toggle — pedir assinatura */}
            <div className="mt-4 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-700">Pedir assinatura</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {form.requires_signature
                    ? 'Paciente receberá um link para assinar digitalmente'
                    : 'Documento enviado como mensagem simples, sem assinatura'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, requires_signature: !f.requires_signature }))}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                  form.requires_signature ? 'bg-violet-600' : 'bg-slate-300'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.requires_signature ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Upload de imagem */}
            <div className="mt-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Imagem do documento <span className="text-xs text-slate-400 font-normal">(opcional — enviada junto com o texto)</span>
              </label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 rounded-xl border border-slate-200 object-contain bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(''); setForm(f => ({ ...f, image_url: '' })) }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors">
                  {uploadingImage ? (
                    <span className="text-sm text-slate-500">Enviando...</span>
                  ) : (
                    <>
                      <Icon name="image" className="w-5 h-5 text-slate-400" />
                      <span className="text-sm text-slate-500">Clique para adicionar uma imagem (JPG, PNG, WEBP — máx. 5MB)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]) }}
                  />
                </label>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-6 border-2 border-dashed" style={{ borderColor: form.theme_color, background: `${form.theme_color}10` }}>
            <div className="text-center">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: form.theme_color }}
              >
                <Icon name="clipboard" className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Ficha de Anamnese Interativa</h3>
              <p className="text-sm text-slate-500 mb-4">
                Este template usa um formulário especial com perguntas sobre procedimentos, 
                alergias, medicamentos, saúde e assinatura digital.
              </p>
              <div className="text-xs text-slate-400">
                O paciente receberá um link elegante para preencher a ficha completa.
              </div>
            </div>
          </div>
        )}
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
