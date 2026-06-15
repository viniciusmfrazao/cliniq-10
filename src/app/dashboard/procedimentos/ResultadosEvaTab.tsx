'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import Icon from '@/components/ui/Icon'

type ResultImage = {
  id: string
  image_url: string
  storage_path: string
  caption: string | null
  display_order: number
  active: boolean
  lgpd_consent: boolean
}

type Props = {
  clinicId: string
  procedureId: string
  procedureName: string
}

export default function ResultadosEvaTab({ clinicId, procedureId, procedureName }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [images, setImages] = useState<ResultImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lgpdConfirm, setLgpdConfirm] = useState(false)

  useEffect(() => {
    loadImages()
  }, [procedureId])

  async function loadImages() {
    setLoading(true)
    const { data } = await supabase
      .from('procedure_result_images')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('procedure_id', procedureId)
      .order('display_order', { ascending: true })
    setImages(data || [])
    setLoading(false)
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!lgpdConfirm) {
      toast.error('Confirme o consentimento LGPD antes de fazer upload')
      return
    }
    if (images.length >= 6) {
      toast.error('Máximo de 6 imagens por procedimento')
      return
    }

    setUploading(true)
    try {
      const toUpload = Array.from(files).slice(0, 6 - images.length)
      for (const file of toUpload) {
        if (!file.type.startsWith('image/')) continue
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} excede 5MB`)
          continue
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${clinicId}/${procedureId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: upErr } = await supabase.storage
          .from('result-images')
          .upload(path, file, { upsert: false })
        if (upErr) { toast.error('Erro no upload: ' + upErr.message); continue }

        const { data: { publicUrl } } = supabase.storage
          .from('result-images')
          .getPublicUrl(path)

        const nextOrder = images.length + 1
        const { error: dbErr } = await supabase
          .from('procedure_result_images')
          .insert({
            clinic_id: clinicId,
            procedure_id: procedureId,
            image_url: publicUrl,
            storage_path: path,
            display_order: nextOrder,
            active: true,
            lgpd_consent: true,
          })
        if (dbErr) { toast.error('Erro ao salvar: ' + dbErr.message); continue }
      }
      await loadImages()
      toast.success('Imagens salvas com sucesso')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function toggleActive(img: ResultImage) {
    const { error } = await supabase
      .from('procedure_result_images')
      .update({ active: !img.active })
      .eq('id', img.id)
    if (error) { toast.error('Erro ao atualizar'); return }
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, active: !img.active } : i))
  }

  async function updateCaption(id: string, caption: string) {
    await supabase
      .from('procedure_result_images')
      .update({ caption })
      .eq('id', id)
  }

  async function removeImage(img: ResultImage) {
    const { error: dbErr } = await supabase
      .from('procedure_result_images')
      .delete()
      .eq('id', img.id)
    if (dbErr) { toast.error('Erro ao remover'); return }

    await supabase.storage.from('result-images').remove([img.storage_path])
    setImages(prev => prev.filter(i => i.id !== img.id))
    toast.success('Imagem removida')
  }

  async function moveOrder(id: string, direction: 'up' | 'down') {
    const idx = images.findIndex(i => i.id === id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === images.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const newImages = [...images]
    const temp = newImages[idx]
    newImages[idx] = newImages[swapIdx]
    newImages[swapIdx] = temp

    // Atualizar display_order
    const updates = newImages.map((img, i) => ({ id: img.id, display_order: i + 1 }))
    for (const u of updates) {
      await supabase.from('procedure_result_images').update({ display_order: u.display_order }).eq('id', u.id)
    }
    setImages(newImages.map((img, i) => ({ ...img, display_order: i + 1 })))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner label="Carregando imagens..." />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header informativo */}
      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
            <Icon name="robot" className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Galeria de resultados — EVA
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
              Quando um lead demonstrar interesse em <strong>{procedureName}</strong>, a EVA enviará automaticamente até {Math.min(images.filter(i => i.active).length || 3, 3)} dessas fotos pelo WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de imagens */}
      {images.length > 0 && (
        <div className="space-y-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`flex gap-3 p-3 rounded-xl border ${img.active
                ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60'
              }`}
            >
              {/* Preview */}
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                <img
                  src={img.image_url}
                  alt={`Resultado ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Caption + controles */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    #{idx + 1}
                  </span>
                  {!img.active && (
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                      inativa
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  defaultValue={img.caption || ''}
                  placeholder="Legenda opcional..."
                  className="input text-sm w-full"
                  onBlur={e => updateCaption(img.id, e.target.value)}
                />
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => moveOrder(img.id, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Mover para cima"
                >
                  <Icon name="chevron-up" className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveOrder(img.id, 'down')}
                  disabled={idx === images.length - 1}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Mover para baixo"
                >
                  <Icon name="chevron-down" className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(img)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  title={img.active ? 'Desativar' : 'Ativar'}
                >
                  <Icon name={img.active ? 'eye' : 'eye-off'} className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeImage(img)}
                  className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                  title="Remover"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      {images.length < 6 && (
        <div className="space-y-3">
          {/* Consentimento LGPD */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 cursor-pointer">
            <input
              type="checkbox"
              checked={lgpdConfirm}
              onChange={e => setLgpdConfirm(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <span className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Confirmo que tenho <strong>autorização expressa das pacientes</strong> para uso das imagens publicadas, conforme exigido pela LGPD (Lei 13.709/2018).
            </span>
          </label>

          {/* Área de upload */}
          <div
            onClick={() => lgpdConfirm && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              lgpdConfirm
                ? 'border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 cursor-pointer bg-purple-50/50 dark:bg-purple-950/10'
                : 'border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <LoadingSpinner size="sm" />
                <p className="text-sm text-slate-500">Enviando...</p>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mx-auto mb-2">
                  <Icon name="upload" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Clique para adicionar fotos
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  JPG, PNG ou WebP • Máx. 5MB por foto • {6 - images.length} vaga{6 - images.length !== 1 ? 's' : ''} disponível{6 - images.length !== 1 ? 'is' : ''}
                </p>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>
      )}

      {images.length === 0 && !uploading && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-2">
          Nenhuma imagem cadastrada ainda. Adicione fotos de antes/depois para a EVA enviar automaticamente.
        </p>
      )}

      {images.length >= 6 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          Limite de 6 imagens atingido. Remova uma para adicionar outra.
        </p>
      )}
    </div>
  )
}
