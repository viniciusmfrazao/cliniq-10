'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

type Document = {
  id: string
  name: string
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'expired'
  signed_at: string | null
  whatsapp_sent_at: string | null
  sign_token: string | null
}

type Template = { id: string; name: string }

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-500',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-amber-100 text-amber-700',
  signed: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', sent: 'Enviado', viewed: 'Visualizado',
  signed: 'Assinado', expired: 'Expirado',
}

type Props = {
  patientId: string
  patientName: string
  patientPhone: string | null
  appointmentId: string
  procedureName: string | null
  clinicId: string
}

export default function DocumentosAtendimento({
  patientId, patientName, patientPhone, appointmentId, procedureName, clinicId
}: Props) {
  const toast = useToast()
  const [docs, setDocs] = useState<Document[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    loadDocs()
    supabase.from('document_templates').select('id, name')
      .eq('clinic_id', clinicId).eq('is_active', true).order('name')
      .then(({ data }) => setTemplates(data || []))
  }, [appointmentId])

  // Realtime — atualiza quando paciente assina
  useEffect(() => {
    const channel = supabase.channel(`docs-apt-${appointmentId}`)
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'documents_sent',
        filter: `appointment_id=eq.${appointmentId}`,
      }, () => loadDocs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [appointmentId])

  async function loadDocs() {
    const { data } = await supabase
      .from('documents_sent')
      .select('id, name, status, signed_at, whatsapp_sent_at, sign_token')
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
    setDocs(data || [])
  }

  async function sendDoc(templateId: string) {
    setSending(templateId)
    setShowPicker(false)
    try {
      const res = await fetch('/api/documento/send-from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, appointmentId, templateId }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Documento enviado para ${patientName.split(' ')[0]}!`)
        loadDocs()
      } else if (data.link) {
        await navigator.clipboard.writeText(data.link).catch(() => {})
        toast.success('Link copiado — WhatsApp indisponível')
        loadDocs()
      } else {
        toast.error('Erro ao enviar', { description: data.error })
      }
    } catch { toast.error('Erro de rede') }
    finally { setSending(null) }
  }

  async function resend(docId: string) {
    setSending(docId)
    try {
      const res = await fetch('/api/documento/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoId: docId }),
      })
      const data = await res.json()
      if (data.ok) toast.success('Documento reenviado!')
      else toast.error('Erro ao reenviar')
      loadDocs()
    } catch { toast.error('Erro de rede') }
    finally { setSending(null) }
  }

  // Sugerir templates pelo nome do procedimento
  const suggested = procedureName
    ? templates.filter(t => t.name.toLowerCase().includes(procedureName.toLowerCase().split(' ')[0]))
    : []
  const others = templates.filter(t => !suggested.find(s => s.id === t.id))

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.clinike.com.br'

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="file" className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Documentos</h3>
          {docs.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{docs.length}</span>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowPicker(p => !p)}
            className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            Enviar
          </button>

          {showPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-2">
              <p className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">Enviar para {patientName.split(' ')[0]}</p>

              {suggested.length > 0 && (
                <>
                  <p className="text-[10px] text-violet-500 font-semibold px-2 pt-1">Sugerido</p>
                  {suggested.map(t => (
                    <button key={t.id} onClick={() => sendDoc(t.id)} disabled={!!sending}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-violet-50 rounded-lg">
                      {t.name}
                    </button>
                  ))}
                  {others.length > 0 && <div className="border-t border-slate-100 my-1" />}
                </>
              )}

              {others.map(t => (
                <button key={t.id} onClick={() => sendDoc(t.id)} disabled={!!sending}
                  className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg">
                  {t.name}
                </button>
              ))}

              {templates.length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-2">Nenhum template cadastrado.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">Nenhum documento enviado ainda.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{doc.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[doc.status]}`}>
                    {STATUS_LABEL[doc.status]}
                  </span>
                  {doc.signed_at && (
                    <span className="text-[9px] text-emerald-600">
                      ✓ {new Date(doc.signed_at).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {doc.sign_token && (
                  <a href={`${siteUrl}/assinar/${doc.sign_token}`} target="_blank" rel="noreferrer"
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                    <Icon name="eye" className="w-3.5 h-3.5" />
                  </a>
                )}
                {doc.status !== 'signed' && doc.status !== 'expired' && (
                  <button onClick={() => resend(doc.id)} disabled={sending === doc.id}
                    className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg"
                    title="Reenviar WhatsApp">
                    {sending === doc.id
                      ? <span className="animate-spin w-3.5 h-3.5 border border-slate-300 border-t-emerald-500 rounded-full block" />
                      : <Icon name="phone" className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
