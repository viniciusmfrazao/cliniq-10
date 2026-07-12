'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

export type EnvioMode = 'texto' | 'audio' | 'ambos'

interface Props {
  clinicId: string
  automationKey: string
  mode: EnvioMode
  onModeChange: (mode: EnvioMode) => void
  audioUrl: string | null
  onAudioChange: (url: string | null) => void
  label?: string
}

const MODES: { value: EnvioMode; label: string }[] = [
  { value: 'texto', label: 'Texto' },
  { value: 'audio', label: 'Áudio' },
  { value: 'ambos', label: 'Ambos' },
]

export default function AudioModeField({
  clinicId, automationKey, mode, onModeChange, audioUrl, onAudioChange, label,
}: Props) {
  const supabase = createClient()
  const toast = useToast()
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(audioUrl)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => chunksRef.current.push(e.data)
      rec.onstop = () => uploadRecording()
      rec.start()
      mediaRecorderRef.current = rec
      setSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      toast.error('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  async function uploadRecording() {
    setUploading(true)
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const path = `${clinicId}/${automationKey}-${Date.now()}.webm`
      const { error: upErr } = await supabase.storage
        .from('automation-audios')
        .upload(path, blob, { upsert: false, contentType: 'audio/webm' })
      if (upErr) {
        toast.error('Erro no upload do áudio: ' + upErr.message)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('automation-audios').getPublicUrl(path)
      setPreviewUrl(publicUrl)
      onAudioChange(publicUrl)
    } finally {
      setUploading(false)
    }
  }

  async function deleteRecording() {
    setPreviewUrl(null)
    onAudioChange(null)
  }

  const timeLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const showText = mode === 'texto' || mode === 'ambos'
  const showAudio = mode === 'audio' || mode === 'ambos'

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-slate-900">{label ?? 'Forma de envio'}</label>
        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === m.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showAudio && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2">
          {!recording && !previewUrl && (
            <button
              type="button"
              onClick={startRecording}
              disabled={uploading}
              className="flex items-center gap-2 text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-violet-300 disabled:opacity-60"
            >
              <Icon name="mic" className="w-4 h-4 text-violet-600" />
              {uploading ? 'Enviando...' : 'Gravar áudio'}
            </button>
          )}

          {recording && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 text-sm px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg"
              >
                <Icon name="stopSquare" className="w-4 h-4" />
                Parar
              </button>
              <span className="text-sm text-red-600 font-mono">{timeLabel}</span>
            </div>
          )}

          {!recording && previewUrl && (
            <div className="flex items-center gap-3 flex-wrap">
              <audio src={previewUrl} controls className="h-9 max-w-[220px]" />
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-violet-300"
              >
                <Icon name="refresh" className="w-3.5 h-3.5" /> Regravar
              </button>
              <button
                type="button"
                onClick={deleteRecording}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Icon name="trash" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {showText && <p className="text-xs text-slate-400 mt-2">Enviado junto com a mensagem de texto abaixo.</p>}
        </div>
      )}

      {!showText && <div className="hidden" />}
    </div>
  )
}
