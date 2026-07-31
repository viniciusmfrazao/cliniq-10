'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { parseSupabaseError } from '@/lib/error-messages'

type Attachment = {
  id: string
  title: string
  file_path: string
  file_name: string
  mimetype: string | null
  file_size: number | null
  created_at: string
}

type Props = {
  patientId: string
  clinicId: string
  professionalId: string
  /** Se informado, o upload feito aqui é vinculado a este atendimento. */
  appointmentId?: string
  /**
   * 'panel' = card compacto usado dentro do atendimento (mostra só os
   * mais recentes + link pra ficha completa).
   * 'full' = lista completa, usada na aba "Anexos" da ficha do paciente.
   */
  variant?: 'panel' | 'full'
  /** URL da aba "Anexos" na ficha do paciente, usada no link "ver todos" (só no variant panel). */
  patientTabUrl?: string
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB (alinhado com o bucket)
const ACCEPTED = 'image/*,application/pdf,.doc,.docx'
const PANEL_LIMIT = 4

function sanitizeFilename(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
  return cleaned.length > 80 ? cleaned.slice(-80) : cleaned
}

function fileIcon(mimetype: string | null) {
  if (mimetype?.startsWith('image/')) return 'image'
  return 'file'
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PatientAttachments({
  patientId,
  clinicId,
  professionalId,
  appointmentId,
  variant = 'full',
  patientTabUrl,
}: Props) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('patient_attachments')
      .select('id, title, file_path, file_name, mimetype, file_size, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [patientId, supabase])

  useEffect(() => {
    load()
  }, [load])

  // Realtime — se o anexo for adicionado em outra aba/tela (ex: no atendimento
  // enquanto a ficha do paciente está aberta em outra janela), atualiza a lista.
  useEffect(() => {
    const channel = supabase
      .channel(`patient-attachments-${patientId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'patient_attachments', filter: `patient_id=eq.${patientId}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientId, supabase, load])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" tem mais de 20MB e não pode ser enviado.`)
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFilename(file.name)}`
      const path = `${clinicId}/${patientId}/anexos/${filename}`

      const { error: upErr } = await supabase.storage
        .from('medical-attachments')
        .upload(path, file, { contentType: file.type || `application/${ext}`, upsert: false })

      if (upErr) throw new Error(upErr.message)

      const title = file.name.replace(/\.[^./]+$/, '')

      const { error: insErr } = await supabase.from('patient_attachments').insert({
        clinic_id: clinicId,
        patient_id: patientId,
        uploaded_by: professionalId,
        appointment_id: appointmentId || null,
        title,
        file_path: path,
        file_name: file.name,
        mimetype: file.type || null,
        file_size: file.size,
      })

      if (insErr) throw new Error(insErr.message)

      toast.success('Anexo adicionado')
      load()
    } catch (err) {
      toast.error(parseSupabaseError(err))
    } finally {
      setUploading(false)
    }
  }

  async function handleView(item: Attachment) {
    const { data, error } = await supabase.storage
      .from('medical-attachments')
      .createSignedUrl(item.file_path, 60 * 5)
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível abrir o arquivo')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(item: Attachment) {
    if (!confirm(`Remover "${item.title}"? Essa ação não pode ser desfeita.`)) return
    setDeletingId(item.id)
    try {
      await supabase.storage.from('medical-attachments').remove([item.file_path])
      const { error } = await supabase.from('patient_attachments').delete().eq('id', item.id)
      if (error) throw new Error(error.message)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success('Anexo removido')
    } catch (err) {
      toast.error(parseSupabaseError(err))
    } finally {
      setDeletingId(null)
    }
  }

  const visibleItems = variant === 'panel' ? items.slice(0, PANEL_LIMIT) : items

  return (
    <div className={variant === 'panel' ? 'card p-5' : 'card p-6'}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Icon name="paperclip" className="w-5 h-5 text-violet-500" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Anexos</h2>
            <p className="text-xs text-slate-500">Exames, laudos e outros documentos do paciente</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-60"
        >
          {uploading ? (
            <Icon name="loader" className="w-4 h-4 animate-spin" />
          ) : (
            <Icon name="upload" className="w-4 h-4" />
          )}
          {uploading ? 'Enviando...' : 'Adicionar'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Nenhum anexo cadastrado ainda</p>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors group"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                <Icon name={fileIcon(item.mimetype)} className="w-4 h-4 text-slate-400" />
              </span>
              <button
                type="button"
                onClick={() => handleView(item)}
                className="min-w-0 flex-1 text-left"
                title="Abrir arquivo"
              >
                <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                <p className="text-xs text-slate-400">
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  {item.file_size ? ` · ${formatSize(item.file_size)}` : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleView(item)}
                className="p-1.5 text-slate-400 hover:text-violet-600 transition-colors"
                title="Baixar / visualizar"
              >
                <Icon name="download" className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                disabled={deletingId === item.id}
                className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                title="Remover"
              >
                {deletingId === item.id ? (
                  <Icon name="loader" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon name="trash" className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {variant === 'panel' && items.length > PANEL_LIMIT && patientTabUrl && (
        <a
          href={patientTabUrl}
          className="mt-3 block text-center text-xs font-semibold text-violet-600 hover:text-violet-700"
        >
          Ver todos os anexos ({items.length})
        </a>
      )}
    </div>
  )
}
