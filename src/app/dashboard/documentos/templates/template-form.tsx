'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { parseSupabaseError } from '@/lib/error-messages'

type Question = { id: string; text: string }

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
    questions?: Question[]
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
  const [questions, setQuestions] = useState<Question[]>(template?.questions || [])
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

  function addQuestion() {
    setQuestions(prev => [...prev, { id: crypto.randomUUID(), text: '' }])
  }

  function updateQuestion(id: string, text: string) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, text } : q))
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handleImageUpload(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) { alert('Apenas JPG, PNG, WEBP ou PDF'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Arquivo deve ter no máximo 10MB'); return }
    setUploadingImage(true)
    const ext = file.name.split('.').pop()
    const path = `templates/${clinicId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { alert('Erro ao fazer upload: ' + error.message); setUploadingImage(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    setForm(f => ({ ...f, image_url: publicUrl }))
    setImagePreview(publicUrl)
    setUploadingImage(false)
  }

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
      const validQuestions = questions.filter(q => q.text.trim())
      const dataToSave = {
        ...form,
        content: form.category === 'anamnese' ? 'ANAMNESE_FORM' : form.content,
        image_url: form.image_url || null,
        requires_signature: form.requires_signature,
        questions: validQuestions,
      }
      
      if (template) {
        const { error } = await supabase
          .from('document_templates')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', template.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('document_templates')
          .insert({ ...dataToSave, clinic_id: clinicId })
        if (error) throw error
      }

      router.push('/dashboard/documentos/templates')
      router.refresh()
    } catch (err: any) {
      alert('Erro ao salvar template: ' + (err?.message || JSON.stringify(err)))
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

            {/* ── Perguntas Sim/Não ── */}
            <div className="mt-4 p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-violet-800">Perguntas Sim / Não</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    O paciente responderá antes de assinar o documento
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>

              {questions.length === 0 && (
                <p className="text-xs text-violet-400 text-center py-2">
                  Nenhuma pergunta adicionada. Clique em "Adicionar" para incluir.
                </p>
              )}

              {questions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-2">
                  <span className="text-xs text-violet-400 font-mono w-5 text-right flex-shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => updateQuestion(q.id, e.target.value)}
                    placeholder="Ex: Autoriza o uso de fotos para fins educacionais?"
                    className="flex-1 px-3 py-2 text-sm bg-white border border-violet-200 rounded-lg focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {questions.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-violet-100">
                  <div className="flex gap-3 text-xs text-violet-500">
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full border-2 border-emerald-400 flex items-center justify-center text-[10px] font-bold text-emerald-600">S</span>
                      Sim
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full border-2 border-red-400 flex items-center justify-center text-[10px] font-bold text-red-600">N</span>
                      Não
                    </span>
                  </div>
                  <span className="text-xs text-violet-400">— opções que o paciente verá</span>
                </div>
              )}
            </div>

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
                Anexo do documento <span className="text-xs text-slate-400 font-normal">(opcional — enviado junto com o texto)</span>
              </label>
              {imagePreview ? (
                <div className="relative inline-block">
                  {imagePreview.toLowerCase().endsWith('.pdf') ? (
                    <a
                      href={imagePreview}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 h-32 w-64 rounded-xl border border-slate-200 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-red-500 text-white font-bold text-xs flex items-center justify-center shrink-0">PDF</div>
                      <div className="text-sm text-slate-700 truncate">Clique para abrir o PDF</div>
                    </a>
                  ) : (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-32 rounded-xl border border-slate-200 object-contain bg-slate-50"
                    />
                  )}
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
                      <span className="text-sm text-slate-500">Clique para adicionar imagem ou PDF (JPG, PNG, WEBP, PDF — máx. 10MB)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
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
