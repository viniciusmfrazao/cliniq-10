'use client'

import { useState, useEffect } from 'react'
import SignatureForm from './signature-form'

type DocumentData = {
  id: string
  name: string
  content: string
  status: string
  signed_at?: string
  signer_role?: string
  signer_name?: string
  signer_registration?: string
  signature_ip?: string
  signature_country?: string
  signature_data?: string
  questions?: { id: string; text: string }[]
  image_url?: string | null
  patients: { name: string }
  clinics: { name: string; cnpj?: string; clinic_phone?: string }
  users?: { name: string }
}

export default function SignaturePageClient({ token }: { token: string }) {
  const [doc, setDoc] = useState<DocumentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDocument() {
      try {
        const response = await fetch(`/api/documents/sign/${token}`)
        
        if (response.status === 404) {
          setError('not_found')
          return
        }
        
        if (!response.ok) {
          throw new Error('Erro ao carregar documento')
        }
        
        const data = await response.json()
        setDoc(data)
      } catch (err) {
        setError('error')
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-600">Carregando documento...</p>
        </div>
      </div>
    )
  }

  if (error === 'not_found' || !doc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link inválido</h1>
          <p className="text-slate-600">
            O link de assinatura que você acessou é inválido ou foi removido.
          </p>
        </div>
      </div>
    )
  }

  if (doc.status === 'signed') {
    const signedByProfessional = doc.signer_role === 'profissional'
    const shortId = doc.id?.slice(0, 8).toUpperCase()
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 print:bg-white print:p-0">
        <div className="max-w-2xl mx-auto py-8 print:py-0">
          <div className="flex justify-end mb-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              Imprimir / Salvar PDF
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4 print:shadow-none print:rounded-none">
            {signedByProfessional && (
              <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{doc.clinics?.name || 'Clínica'}</p>
                  <p className="text-xs text-slate-400">
                    {[doc.clinics?.cnpj && `CNPJ ${doc.clinics.cnpj}`, doc.clinics?.clinic_phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {shortId && <p className="text-[10px] text-slate-300 font-mono">Doc. {shortId}</p>}
              </div>
            )}
            <div className="bg-emerald-50 px-6 py-5 border-b border-emerald-100 text-center print:bg-white">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center print:hidden">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900">{doc.name}</h1>
              {!signedByProfessional && (
                <p className="text-sm text-slate-500 mt-1">
                  Assinado em{' '}
                  {doc.signed_at && new Date(doc.signed_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <div className="p-6 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible">
              {doc.content}
            </div>
            {signedByProfessional && (
              <div className="px-6 pb-4">
                {doc.signature_data && (
                  <>
                    <p className="text-xs text-slate-400 mb-1">Assinatura:</p>
                    <img src={doc.signature_data} alt="Assinatura" className="h-20 border-b border-slate-200 mb-2" />
                  </>
                )}
                <p className="text-sm font-medium text-slate-900">
                  Documento assinado por {doc.signer_name || doc.users?.name || doc.clinics?.name || 'sua clínica'}
                </p>
                {doc.signer_registration && (
                  <p className="text-xs text-slate-500">{doc.signer_registration}</p>
                )}
                {doc.patients?.name && (
                  <p className="text-xs text-slate-500">Paciente: {doc.patients.name}</p>
                )}
                <p className="text-xs text-slate-500">
                  {doc.signed_at && new Date(doc.signed_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            {signedByProfessional && (
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 print:bg-white">
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                  Assinatura eletrônica simples (Lei 14.063/2020) · Assinado em{' '}
                  {doc.signed_at && new Date(doc.signed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  {doc.signature_ip && <> · IP {doc.signature_ip}</>}
                  {doc.signature_country && <> · {doc.signature_country}</>}
                  {shortId && <> · Documento nº {shortId}</>}
                </p>
              </div>
            )}
          </div>
          {signedByProfessional && (
            <p className="text-xs text-slate-400 text-center px-4">
              Este documento não substitui receita de medicamento controlado, que exige certificado digital ICP-Brasil.
            </p>
          )}
        </div>
      </div>
    )
  }

  if (doc.status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link expirado</h1>
          <p className="text-slate-600">
            Este link de assinatura expirou. Entre em contato com a clínica para solicitar um novo link.
          </p>
        </div>
      </div>
    )
  }

  if (doc.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Documento cancelado</h1>
          <p className="text-slate-600">
            Este documento foi cancelado pela clínica.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-slate-700">{doc.clinics?.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{doc.name}</h1>
          <p className="text-slate-600">
            Olá, <strong>{doc.patients?.name}</strong>
          </p>
        </div>

        {doc.image_url && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            {doc.image_url.toLowerCase().endsWith('.pdf') ? (
              <>
                <iframe
                  src={doc.image_url}
                  title="Documento"
                  className="w-full h-[70vh] border-0"
                />
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center">
                  <a
                    href={doc.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-violet-600 hover:text-violet-800"
                  >
                    Abrir PDF em nova aba
                  </a>
                </div>
              </>
            ) : (
              <img src={doc.image_url} alt={doc.name} className="w-full h-auto" />
            )}
          </div>
        )}

        <SignatureForm doc={doc} token={token} />
      </div>
    </div>
  )
}
