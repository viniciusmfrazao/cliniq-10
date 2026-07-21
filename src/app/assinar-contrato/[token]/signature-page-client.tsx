'use client'

import { useState, useEffect } from 'react'
import ContractSignatureForm from './contract-signature-form'

type ContractData = {
  id: string
  content: string
  status: string
  signed_at?: string
  plan_name?: string
  plan_price?: number
  clinics: { name: string }
}

export default function ContractSignaturePageClient({ token }: { token: string }) {
  const [doc, setDoc] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchContract() {
      try {
        const response = await fetch(`/api/contratos/sign/${token}`)

        if (response.status === 404) {
          setError('not_found')
          return
        }
        if (!response.ok) throw new Error('Erro ao carregar contrato')

        const data = await response.json()
        setDoc(data)
      } catch {
        setError('error')
      } finally {
        setLoading(false)
      }
    }
    fetchContract()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-600">Carregando contrato...</p>
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
          <p className="text-slate-600">O link de contrato que você acessou é inválido ou foi removido.</p>
        </div>
      </div>
    )
  }

  if (doc.status === 'signed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-3xl mx-auto py-8 space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Contrato assinado</h1>
            <p className="text-slate-600">
              Este contrato foi assinado em{' '}
              {doc.signed_at && new Date(doc.signed_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Texto assinado (registro)</h2>
            </div>
            <div className="p-6 max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words text-slate-700 font-mono text-sm leading-relaxed">
              {doc.content}
            </div>
          </div>
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
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Contrato cancelado</h1>
          <p className="text-slate-600">Este contrato foi cancelado pela Clinike.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-slate-700">Clinike</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Contrato de Adesão</h1>
          <p className="text-slate-600">
            Bem-vindo(a), <strong>{doc.clinics?.name}</strong>
          </p>
        </div>

        <ContractSignatureForm doc={doc} token={token} />
      </div>
    </div>
  )
}
