'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import AutoTextarea from '@/components/ui/AutoTextarea'
import PhotoLightbox from '@/components/ui/PhotoLightbox'
import { parseSupabaseError } from '@/lib/error-messages'


type Props = {
  patient: { id: string; name: string }
  appointmentId: string
  pastAppointments: Array<{
    id: string
    start_time: string
    status: string
    procedures: { name: string }[] | { name: string } | null
  }>
  medicalRecords: Array<{
    id: string
    type: string
    title: string
    content: string
    created_at: string
    photos?: string[] | null
  }>
  clinicId: string
  professionalId: string
  hasIaModule?: boolean
}

type LocalPhoto = {
  id: string
  file: File
  previewUrl: string
  uploading?: boolean
  error?: string | null
}

const MAX_PHOTO_SIZE = 20 * 1024 * 1024 // 20MB (alinhado com bucket)

function sanitizeFilename(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
  return cleaned.length > 80 ? cleaned.slice(-80) : cleaned
}

export default function MedicalRecordSection({
  patient,
  appointmentId,
  pastAppointments,
  medicalRecords,
  clinicId,
  professionalId,
  hasIaModule = false,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  // State do lightbox: qual record abriu e em qual índice. Só é resolvido
  // quando temos signed URLs disponíveis pra todas as fotos do record.
  const [lightbox, setLightbox] = useState<{ recordId: string; index: number } | null>(null)

  const lightboxUrls = useMemo(() => {
    if (!lightbox) return [] as string[]
    const record = medicalRecords.find((r) => r.id === lightbox.recordId)
    if (!record?.photos) return []
    return record.photos.map((p) => signedUrls[p]).filter((u): u is string => !!u)
  }, [lightbox, medicalRecords, signedUrls])

  const DRAFT_KEY = `atendimento_draft_${appointmentId}`

  const [form, setForm] = useState(() => {
    if (typeof window === 'undefined') return { complaint: '', conduct: '', observations: '' }
    try {
      const saved = window.localStorage.getItem(`atendimento_draft_${appointmentId}`)
      if (saved) return JSON.parse(saved)
    } catch {}
    return { complaint: '', conduct: '', observations: '' }
  })
  const [autoSaved, setAutoSaved] = useState(false)

  // IA — Resumo e sugestão de conduta
  const [iaResumo, setIaResumo] = useState<string | null>(null)
  const [iaResumoLoading, setIaResumoLoading] = useState(false)
  const [iaSugestao, setIaSugestao] = useState<string | null>(null)
  const [iaSugestaoLoading, setIaSugestaoLoading] = useState(false)

  async function fetchResumoIA() {
    setIaResumoLoading(true); setIaResumo(null)
    try {
      const resp = await fetch('/api/ia/prontuario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resumo', patientId: patient.id, clinicId, appointmentId }) })
      const data = await resp.json()
      setIaResumo(data.ok ? data.result : 'N\u00e3o foi poss\u00edvel gerar o resumo.')
    } catch { setIaResumo('Erro ao conectar com a IA.') } finally { setIaResumoLoading(false) }
  }

  async function fetchSugestaoIA() {
    if (!form.complaint.trim()) return
    setIaSugestaoLoading(true); setIaSugestao(null)
    try {
      const resp = await fetch('/api/ia/prontuario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sugestao_conduta', patientId: patient.id, clinicId, appointmentId, queixa: form.complaint }) })
      const data = await resp.json()
      setIaSugestao(data.ok ? data.result : 'N\u00e3o foi poss\u00edvel gerar sugest\u00e3o.')
    } catch { setIaSugestao('Erro ao conectar com a IA.') } finally { setIaSugestaoLoading(false) }
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Quando entra na aba histórico, gera signed URLs pras fotos persistidas
  useEffect(() => {
    if (activeTab !== 'history') return
    const allPaths = medicalRecords.flatMap((r) => r.photos ?? [])
    const missing = allPaths.filter((p) => p && !signedUrls[p])
    if (missing.length === 0) return

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.storage
        .from('medical-attachments')
        .createSignedUrls(missing, 60 * 60) // 1 hora
      if (cancelled || error || !data) return
      const next: Record<string, string> = {}
      data.forEach((d) => {
        if (d.path && d.signedUrl) next[d.path] = d.signedUrl
      })
      setSignedUrls((prev) => ({ ...prev, ...next }))
    })()

    return () => {
      cancelled = true
    }
  }, [activeTab, medicalRecords, signedUrls, supabase])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const accepted: LocalPhoto[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_PHOTO_SIZE) {
        alert(`"${file.name}" tem mais de 20MB e não pode ser anexada.`)
        continue
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (accepted.length) {
      setPhotos((prev) => [...prev, ...accepted])
    }
    // limpa o input pra permitir mesmo arquivo sequencial
    e.target.value = ''
  }

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = []
    for (const photo of photos) {
      const ext = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFilename(photo.file.name)}`
      const path = `${clinicId}/${patient.id}/${filename}`

      const { error: upErr } = await supabase.storage
        .from('medical-attachments')
        .upload(path, photo.file, {
          contentType: photo.file.type || `image/${ext}`,
          upsert: false,
        })

      if (upErr) {
        // Sinaliza no estado pra UI
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, error: upErr.message } : p)),
        )
        throw new Error(`Falha no upload de "${photo.file.name}": ${upErr.message}`)
      }
      urls.push(path)
    }
    return urls
  }

  const saveMedicalRecord = async () => {
    if (!form.complaint && !form.conduct && !form.observations && photos.length === 0) {
      alert('Preencha algum campo do prontuário ou anexe pelo menos uma foto')
      return
    }

    setSaving(true)

    try {
      // Marca todas como uploading
      setPhotos((prev) => prev.map((p) => ({ ...p, uploading: true, error: null })))

      const uploadedPaths = photos.length > 0 ? await uploadPhotos() : []

      const content = [
        form.complaint && `**Queixa:**\n${form.complaint}`,
        form.conduct && `**Conduta:**\n${form.conduct}`,
        form.observations && `**Observações:**\n${form.observations}`,
      ]
        .filter(Boolean)
        .join('\n\n')

      const { error } = await supabase.from('evolutions').insert({
        clinic_id: clinicId,
        patient_id: patient.id,
        professional_id: professionalId,
        appointment_id: appointmentId, // vincula a evolução ao atendimento atual
        type: 'consultation',
        title: `Atendimento ${new Date().toLocaleDateString('pt-BR')}`,
        content,
        photos: uploadedPaths,
      })

      if (error) {
        console.error('Erro ao salvar:', error)
        alert(parseSupabaseError(error))
        return
      }

      // Limpa o estado: revoga blob URLs e zera fotos
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      setPhotos([])
      setForm({ complaint: '', conduct: '', observations: '' })
      try { window.localStorage.removeItem(DRAFT_KEY) } catch {}
      setAutoSaved(false)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Recarrega os medicalRecords passados via props (server) pra a aba
      // Histórico mostrar a evolução recém-criada sem precisar de F5
      router.refresh()
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Erro ao salvar prontuário')
    } finally {
      setPhotos((prev) => prev.map((p) => ({ ...p, uploading: false })))
      setSaving(false)
    }
  }

  return (
    <div className="card">
      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'current' 
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon name="edit" className="w-4 h-4 inline mr-2" />
          Atendimento Atual
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'history' 
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon name="clock" className="w-4 h-4 inline mr-2" />
          Histórico ({medicalRecords.length})
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'current' ? (
          <div className="space-y-4">

            {/* IA — Resumo do histórico — só aparece se módulo ativo */}
            {hasIaModule && <div className="rounded-xl border border-violet-100 bg-violet-50 dark:bg-violet-900/10 dark:border-violet-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">Resumo do histórico — IA</span>
                </div>
                <button
                  onClick={fetchResumoIA}
                  disabled={iaResumoLoading}
                  className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium transition flex items-center gap-1.5"
                >
                  {iaResumoLoading ? (
                    <><span className="animate-spin">⟳</span> Analisando...</>
                  ) : (
                    <>{iaResumo ? '↺ Atualizar' : '✨ Gerar resumo'}</>
                  )}
                </button>
              </div>
              {iaResumo ? (
                <p className="text-sm text-violet-900 dark:text-violet-200 leading-relaxed whitespace-pre-wrap">{iaResumo}</p>
              ) : (
                <p className="text-xs text-violet-400 italic">Clique em "Gerar resumo" para a IA analisar o histórico desta paciente.</p>
              )}
            </div>}

            {/* Queixa */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Queixa principal
              </label>
              <AutoTextarea
                value={form.complaint}
                onChange={e => { const f = { ...form, complaint: e.target.value }; setForm(f); try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(f)); setAutoSaved(true) } catch {} }}
                placeholder="O que trouxe a paciente hoje..."
                minRows={3}
                maxRows={10}
              />
            </div>

            {/* Conduta */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Conduta / Procedimento realizado
                </label>
                {hasIaModule && <button
                  onClick={fetchSugestaoIA}
                  disabled={iaSugestaoLoading || !form.complaint.trim()}
                  title={!form.complaint.trim() ? 'Preencha a queixa primeiro' : 'Sugerir conduta com IA'}
                  className="text-xs px-2.5 py-1 bg-violet-100 hover:bg-violet-200 disabled:opacity-40 text-violet-700 rounded-lg font-medium transition flex items-center gap-1"
                >
                  {iaSugestaoLoading ? <><span className="animate-spin">⟳</span> Sugerindo...</> : '✨ Sugerir conduta'}
                </button>}
              </div>
              {iaSugestao && (
                <div className="mb-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-violet-800 leading-relaxed whitespace-pre-wrap flex-1">{iaSugestao}</p>
                    <button
                      onClick={() => { const f = { ...form, conduct: iaSugestao }; setForm(f); try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(f)) } catch {}; setIaSugestao(null) }}
                      className="text-xs px-2 py-1 bg-violet-600 text-white rounded-lg whitespace-nowrap hover:bg-violet-700"
                    >
                      Usar esta
                    </button>
                  </div>
                </div>
              )}
              <AutoTextarea
                value={form.conduct}
                onChange={e => { const f = { ...form, conduct: e.target.value }; setForm(f); try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(f)); setAutoSaved(true) } catch {} }}
                placeholder="Descreva o procedimento realizado..."
                minRows={4}
                maxRows={14}
              />
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Observações
              </label>
              <AutoTextarea
                value={form.observations}
                onChange={e => { const f = { ...form, observations: e.target.value }; setForm(f); try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(f)); setAutoSaved(true) } catch {} }}
                placeholder="Notas adicionais, recomendações..."
                minRows={3}
                maxRows={10}
              />
            </div>

            {/* Upload de Fotos */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Fotos antes/depois
                <span className="ml-1 text-xs text-slate-400 hidden sm:inline">
                  (até 20MB — JPG, PNG, WEBP)
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.previewUrl}
                      alt={photo.file.name}
                      className={`w-20 h-20 object-cover rounded-lg border ${
                        photo.error ? 'border-rose-400' : 'border-slate-200'
                      } ${photo.uploading ? 'opacity-60' : ''}`}
                    />
                    {photo.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon name="loader" className="w-5 h-5 text-white animate-spin drop-shadow" />
                      </div>
                    )}
                    {photo.error && (
                      <div
                        className="absolute inset-x-0 bottom-0 bg-rose-500/90 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg"
                        title={photo.error}
                      >
                        Erro
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      disabled={photo.uploading}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                    >
                      <Icon name="x" className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-slate-50 transition-colors">
                  <Icon name="camera" className="w-5 h-5 text-slate-400" />
                  <span className="text-xs text-slate-400 mt-1">Adicionar</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Botão Salvar */}
            <button
              onClick={saveMedicalRecord}
              disabled={saving || saved}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                saved 
                  ? 'bg-emerald-500 text-white cursor-not-allowed' 
                  : 'btn-primary'
              } disabled:opacity-70`}
            >
              {saving ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : saved ? (
                <>
                  <Icon name="check" className="w-5 h-5" />
                  Salvo com sucesso!
                </>
              ) : (
                <>
                  <Icon name="check" className="w-5 h-5" />
                  Salvar prontuário
                </>
              )}
            </button>
            
            {autoSaved && !saved && (
              <span className="text-xs text-slate-400">📝 Rascunho salvo</span>
            )}
            {saved && (
              <p className="text-center text-sm text-emerald-600 mt-2">
                Registro salvo. Para adicionar outro, recarregue a página.
              </p>
            )}
          </div>
        ) : (
          /* Histórico */
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {/* Link para prontuário completo */}
            <Link
              href={`/dashboard/pacientes/${patient.id}?tab=evolucoes`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-violet-50 text-violet-700 rounded-xl font-semibold hover:bg-violet-100 transition-colors"
            >
              <Icon name="file" className="w-5 h-5" />
              Ver prontuário completo
            </Link>

            {medicalRecords.length === 0 ? (
              <div className="text-center py-8">
                <Icon name="file" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum registro anterior</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

                {medicalRecords.map((record, i) => (
                  <div key={record.id} className="relative pl-10 pb-6 last:pb-0">
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-[var(--color-primary)] ring-4 ring-white" />
                    
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase">
                          {record.type}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(record.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-1">{record.title}</h4>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-4">
                        {record.content}
                      </p>
                      {record.photos && record.photos.length > 0 && (
                        <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-2">
                          {record.photos.map((path, idx) => {
                            const url = signedUrls[path]
                            // Mapeia o índice do thumb pro índice na lista
                            // de fotos válidas (com signed URL) — necessário
                            // pro lightbox abrir na foto certa quando
                            // alguma foto falhou ao gerar URL.
                            const validUrls = (record.photos ?? [])
                              .map((p) => signedUrls[p])
                              .filter((u): u is string => !!u)
                            const lightboxIndex = url ? validUrls.indexOf(url) : -1

                            return url ? (
                              <button
                                key={`${record.id}-${idx}`}
                                type="button"
                                onClick={() =>
                                  setLightbox({
                                    recordId: record.id,
                                    index: lightboxIndex >= 0 ? lightboxIndex : 0,
                                  })
                                }
                                className="relative block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-violet-400 hover:ring-2 hover:ring-violet-100 transition-all group"
                                title="Clique para ampliar"
                              >
                                <img
                                  src={url}
                                  alt={`Foto ${idx + 1} do atendimento`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                              </button>
                            ) : (
                              <div
                                key={`${record.id}-${idx}`}
                                className="aspect-square rounded-lg bg-slate-200 animate-pulse"
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Atendimentos anteriores */}
            {pastAppointments.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3">Atendimentos anteriores</h4>
                <div className="space-y-2">
                  {pastAppointments.map(apt => (
                    <div key={apt.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">
                        {Array.isArray(apt.procedures) ? apt.procedures[0]?.name : apt.procedures?.name || 'Atendimento'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(apt.start_time).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox global pra ampliar fotos do histórico */}
      <PhotoLightbox
        open={!!lightbox && lightboxUrls.length > 0}
        urls={lightboxUrls}
        index={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onIndexChange={(next) =>
          setLightbox((prev) => (prev ? { ...prev, index: next } : prev))
        }
        altPrefix="Foto do atendimento"
      />
    </div>
  )
}
