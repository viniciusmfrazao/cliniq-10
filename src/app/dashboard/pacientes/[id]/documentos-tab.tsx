'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'
import DocumentViewModal from '@/components/DocumentViewModal'
import { useToast } from '@/components/ui/Toast'

type Document = {
  id: string
  name: string
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'expired'
  sent_at: string | null
  signed_at: string | null
  expires_at: string | null
  whatsapp_sent_at: string | null
  sign_token: string | null
}

type Template = {
  id: string
  name: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  viewed: 'Visualizado',
  signed: 'Assinado',
  expired: 'Expirado',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-amber-100 text-amber-700',
  signed: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-600',
}

type Props = {
  patientId: string
  patientName: string
  patientPhone: string | null
  clinicId: string
}

export default function DocumentosTab({ patientId, patientName, patientPhone, clinicId }: Props) {
  const toast = useToast()
  const [docs, setDocs] = useState<Document[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [viewingDoc, setViewingDoc] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    loadDocs()
    loadTemplates()
  }, [patientId])

  // Realtime — atualiza quando um documento é enviado ou assinado (ex: pelo atendimento)
  useEffect(() => {
    const channel = supabase.channel(`docs-patient-${patientId}`)
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'documents_sent',
        filter: `patient_id=eq.${patientId}`,
      }, () => loadDocs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [patientId])

  async function loadDocs() {
    setLoading(true)
    const { data } = await supabase
      .from('documents_sent')
      .select('id, name, status, sent_at, signed_at, expires_at, whatsapp_sent_at, sign_token')
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }

  async function loadTemplates() {
    const { data } = await supabase
      .from('document_templates')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name')
    setTemplates(data || [])
  }

  async function sendDoc(templateId: string) {
    setSending(templateId)
    setShowPicker(false)
    try {
      const res = await fetch('/api/documento/send-from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, templateId }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Documento enviado para ${patientName.split(' ')[0]}!`, {
          description: 'Mensagem enviada via WhatsApp.',
        })
        loadDocs()
      } else if (data.link) {
        // Documento criado mas WhatsApp com falha — copia link e avisa
        await navigator.clipboard.writeText(data.link).catch(() => {})
        toast.success('Documento criado! Link copiado.', {
          description: 'Cole o link no WhatsApp para enviar manualmente.',
          duration: 8000,
        })
        loadDocs()
      } else {
        toast.error('Erro ao criar documento', { description: data.error })
      }
    } catch {
      toast.error('Erro de rede, tente novamente')
    } finally {
      setSending(null)
    }
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
      if (data.ok) {
        toast.success('Documento reenviado!')
        loadDocs()
      } else {
        toast.error('Erro ao reenviar', { description: data.error })
      }
    } catch {
      toast.error('Erro de rede')
    } finally {
      setSending(null)
    }
  }

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.clinike.com.br'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Documentos</h3>
          <p className="text-sm text-slate-500">{docs.length} documento{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowPicker(p => !p)}
            className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
          >
            <Icon name="plus" className="w-4 h-4" />
            Enviar documento
          </button>

          {showPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2">
              <p className="text-xs font-semibold text-slate-500 px-2 py-1 mb-1">Escolha o template</p>
              {templates.length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-2">Nenhum template cadastrado.</p>
              )}
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => sendDoc(t.id)}
                  disabled={!!sending}
                  className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-violet-50 rounded-lg transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de documentos */}
      {loading ? (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Icon name="file" className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum documento enviado ainda.</p>
          <p className="text-xs mt-1">Clique em "Enviar documento" para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[doc.status] || STATUS_COLOR.pending}`}>
                      {STATUS_LABEL[doc.status] || doc.status}
                    </span>
                    {doc.sent_at && (
                      <span className="text-[10px] text-slate-400">
                        Enviado em {new Date(doc.sent_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {doc.signed_at && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        ✓ Assinado em {new Date(doc.signed_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Ver documento */}
                  {doc.sign_token && (
                    <a
                      href={`${siteUrl}/assinar/${doc.sign_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                      title="Ver documento"
                    >
                      <Icon name="eye" className="w-4 h-4" />
                    </a>
                  )}

                  {/* Reenviar WhatsApp */}
                  {doc.status !== 'signed' && doc.status !== 'expired' && (
                    <button
                      onClick={() => resend(doc.id)}
                      disabled={sending === doc.id}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                      title={doc.whatsapp_sent_at ? 'Reenviar pelo WhatsApp' : 'Enviar pelo WhatsApp'}
                    >
                      {sending === doc.id
                        ? <span className="animate-spin w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full block" />
                        : <Icon name="phone" className="w-4 h-4" />
                      }
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingDoc && (
        <DocumentViewModal
          documentId={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  )
}
