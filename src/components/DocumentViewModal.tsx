'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'

type DocumentDetail = {
  id: string
  name: string
  content: string
  status: string
  sent_at: string | null
  signed_at: string | null
  expires_at: string | null
  signature_data: string | null
  signature_ip: string | null
  signature_user_agent: string | null
  signature_country: string | null
  questions?: { id: string; text: string }[] | null
  question_answers?: Record<string, 'sim' | 'nao'> | null
  patients: { name: string; phone: string | null } | null
}

type Props = {
  documentId: string
  onClose: () => void
}

export default function DocumentViewModal({ documentId, onClose }: Props) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    supabase
      .from('documents_sent')
      .select('*, patients(name, phone)')
      .eq('id', documentId)
      .single()
      .then(({ data }) => {
        setDoc(data)
        setLoading(false)
      })
  }, [documentId])

  function handlePrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${doc?.name || 'Documento'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; padding: 2cm; }
          .doc-content { line-height: 1.8; white-space: pre-wrap; margin-bottom: 2cm; }
          .signature-block { border-top: 1px solid #ccc; padding-top: 1cm; margin-top: 1cm; }
          .signature-image { max-height: 80px; margin: 10px 0; }
          .signature-info { font-size: 10pt; color: #555; }
          .signature-info p { margin: 3px 0; }
          .doc-header { text-align: center; margin-bottom: 1cm; }
          .doc-header h1 { font-size: 16pt; font-weight: bold; }
          .doc-header p { font-size: 10pt; color: #666; margin-top: 5px; }
          @media print { body { padding: 1.5cm; } }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 500)
  }

  const isSigned = doc?.status === 'signed'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-base">{doc?.name || 'Documento'}</h2>
            {doc?.patients?.name && (
              <p className="text-xs text-slate-500 mt-0.5">{doc.patients.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Icon name="printer" className="w-4 h-4" />
              Imprimir
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 + i * 8}%` }} />)}
            </div>
          ) : !doc ? (
            <p className="text-slate-400 text-center py-8">Documento não encontrado.</p>
          ) : (
            <div ref={printRef}>
              {/* Cabeçalho para impressão */}
              <div className="doc-header hidden print:block mb-6 text-center">
                <h1 className="text-lg font-bold">{doc.name}</h1>
                {doc.patients?.name && (
                  <p className="text-sm text-slate-500">Paciente: {doc.patients.name}</p>
                )}
              </div>

              {/* Conteúdo do documento */}
              <div
                className="doc-content text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif"
                dangerouslySetInnerHTML={{ __html: doc.content?.replace(/\n/g, '<br>') || '' }}
              />

              {/* Respostas Sim/Não */}
              {doc.questions && doc.questions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Respostas do paciente</h3>
                  <div className="space-y-2">
                    {doc.questions.filter(q => q.text.trim()).map(q => {
                      const resp = doc.question_answers?.[q.id]
                      return (
                        <div key={q.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                          <span className="text-sm text-slate-700 flex-1">{q.text}</span>
                          {resp ? (
                            <span className={`ml-3 px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
                              resp === 'sim'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {resp === 'sim' ? '✓ Sim' : '✗ Não'}
                            </span>
                          ) : (
                            <span className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-500 flex-shrink-0">
                              Sem resposta
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Assinatura */}
              {isSigned && (
                <div className="signature-block mt-8 pt-6 border-t border-slate-200">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon name="check" className="w-3.5 h-3.5 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-emerald-800">Documento assinado digitalmente</p>
                    </div>

                    {/* Imagem da assinatura */}
                    {doc.signature_data && (
                      <div className="mb-3 p-3 bg-white rounded-lg border border-emerald-100">
                        <p className="text-[10px] text-slate-400 mb-1">Assinatura do paciente:</p>
                        <img
                          src={doc.signature_data}
                          alt="Assinatura"
                          className="signature-image max-h-20 border border-slate-100 rounded"
                        />
                      </div>
                    )}

                    <div className="signature-info space-y-1">
                      {doc.signed_at && (
                        <p className="text-xs text-emerald-700">
                          <span className="font-medium">Data:</span>{' '}
                          {new Date(doc.signed_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                      {doc.signature_ip && (
                        <p className="text-xs text-emerald-700">
                          <span className="font-medium">IP:</span> {doc.signature_ip}
                        </p>
                      )}
                      {doc.signature_country && (
                        <p className="text-xs text-emerald-700">
                          <span className="font-medium">País:</span> {doc.signature_country}
                        </p>
                      )}
                      {doc.patients?.name && (
                        <p className="text-xs text-emerald-700">
                          <span className="font-medium">Assinado por:</span> {doc.patients.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pendente de assinatura */}
              {!isSigned && doc.status !== 'expired' && (
                <div className="mt-8 pt-6 border-t border-slate-200 border-dashed">
                  <p className="text-xs text-slate-400 text-center">
                    {doc.status === 'viewed'
                      ? '⏳ Paciente visualizou mas ainda não assinou'
                      : '📤 Aguardando assinatura do paciente'
                    }
                  </p>
                </div>
              )}

              {doc.status === 'expired' && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <p className="text-xs text-red-500 text-center">Documento expirado — link de assinatura inválido</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
