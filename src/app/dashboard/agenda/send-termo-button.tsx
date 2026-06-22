'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

type Template = {
  id: string
  name: string
}

type Props = {
  patientId: string
  patientName: string
  patientPhone: string | null
  appointmentId: string
  procedureName?: string | null
  clinicId: string
}

export default function SendTermoButton({
  patientId,
  patientName,
  patientPhone,
  appointmentId,
  procedureName,
  clinicId,
}: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Carregar templates quando abrir o picker
  useEffect(() => {
    if (!showPicker || templates.length > 0) return
    setLoadingTemplates(true)
    supabase
      .from('document_templates')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setTemplates(data)
        setLoadingTemplates(false)
      })
  }, [showPicker, clinicId])

  // Templates sugeridos: os que têm o nome do procedimento no título
  const suggested = procedureName
    ? templates.filter(t =>
        t.name.toLowerCase().includes(procedureName.toLowerCase().split(' ')[0])
      )
    : []
  const others = templates.filter(t => !suggested.includes(t))

  async function sendTermo(templateId: string) {
    setLoading(true)
    setShowPicker(false)
    try {
      const r = await fetch('/api/documento/send-from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, appointmentId, templateId }),
      })
      const data = await r.json()

      if (data.ok) {
        const firstName = patientName.split(' ')[0]
        toast.success(`Termo enviado para ${firstName}`, {
          description: 'Mensagem disparada via WhatsApp da clínica.',
        })
        setDone(true)
      } else if (data.link) {
        try {
          await navigator.clipboard.writeText(data.link)
          toast.success('Link copiado', {
            description: 'WhatsApp indisponível. Cola e envia manualmente.',
          })
        } catch {
          toast.success('Link gerado', { description: data.link })
        }
        setDone(true)
      } else {
        toast.error('Erro ao enviar termo', { description: data.error })
      }
    } catch {
      toast.error('Erro de rede, tente novamente')
    } finally {
      setLoading(false)
    }
  }

  const hasPhone = !!patientPhone?.trim()

  return (
    <div className="relative flex-1">
      <button
        type="button"
        disabled={loading}
        onClick={e => { e.stopPropagation(); setShowPicker(p => !p) }}
        className={`w-full py-1.5 px-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-60 ${
          done
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
        title="Enviar termo de consentimento via WhatsApp"
      >
        {loading ? (
          <span className="animate-spin w-3 h-3 border-2 border-white/40 border-t-white rounded-full" />
        ) : (
          <Icon name={done ? 'check' : 'file'} className="w-3 h-3" />
        )}
        {done ? 'Enviado' : 'Documentos'}
      </button>

      {/* Picker de templates */}
      {showPicker && (
        <div
          className="absolute bottom-full mb-1 left-0 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs font-semibold text-slate-500 px-2 py-1">
            Escolha o termo para enviar
          </p>

          {loadingTemplates && (
            <p className="text-xs text-slate-400 px-2 py-2">Carregando...</p>
          )}

          {!loadingTemplates && templates.length === 0 && (
            <p className="text-xs text-slate-400 px-2 py-2">
              Nenhum template cadastrado.
            </p>
          )}

          {suggested.length > 0 && (
            <>
              <p className="text-[10px] text-violet-500 font-semibold px-2 pt-1">
                Sugerido para {procedureName}
              </p>
              {suggested.map(t => (
                <button
                  key={t.id}
                  onClick={() => sendTermo(t.id)}
                  className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-violet-50 rounded-lg transition-colors"
                >
                  {t.name}
                </button>
              ))}
              {others.length > 0 && (
                <div className="border-t border-slate-100 my-1" />
              )}
            </>
          )}

          {others.map(t => (
            <button
              key={t.id}
              onClick={() => sendTermo(t.id)}
              className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
