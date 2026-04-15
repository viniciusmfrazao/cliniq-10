'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type Props = {
  docId: string
  status: string
  patientName?: string
  patientPhone?: string | null
  docName?: string
}

export default function DocumentActions({ docId, status, patientName, patientPhone, docName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showResendModal, setShowResendModal] = useState(false)
  const [newLink, setNewLink] = useState('')
  const [copied, setCopied] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const cancelDocument = async () => {
    if (!confirm('Tem certeza que deseja cancelar este documento?')) return
    setLoading(true)

    await supabase
      .from('documents_sent')
      .update({ status: 'cancelled' })
      .eq('id', docId)

    router.refresh()
    setLoading(false)
  }

  const resendDocument = async () => {
    const newToken = Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    setLoading(true)

    await supabase
      .from('documents_sent')
      .update({
        status: 'pending',
        sign_token: newToken,
        expires_at: expiresAt.toISOString(),
        viewed_at: null,
      })
      .eq('id', docId)

    const signUrl = `${window.location.origin}/assinar/${newToken}`
    setNewLink(signUrl)
    setShowResendModal(true)
    setLoading(false)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(newLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = newLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const sendWhatsApp = () => {
    const phone = patientPhone?.replace(/\D/g, '') || ''
    const message = encodeURIComponent(
      `Olá ${patientName || ''}!\n\nSegue o novo link para assinar o documento "${docName || 'Documento'}":\n\n${newLink}\n\nO link expira em 7 dias.`
    )
    const whatsappUrl = phone 
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`
    window.open(whatsappUrl, '_blank')
  }

  const closeModal = () => {
    setShowResendModal(false)
    router.refresh()
  }

  if (status === 'signed') {
    return (
      <div className="flex justify-center">
        <button className="btn-secondary w-auto px-6 flex items-center gap-2">
          <Icon name="download" className="w-4 h-4" />
          Baixar PDF
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Resend Modal */}
      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Icon name="check" className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Novo link gerado!</h2>
              <p className="text-sm text-slate-600">
                Envie o novo link para <strong>{patientName}</strong>
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">Link para assinatura:</p>
              <p className="text-sm text-slate-700 break-all font-mono">{newLink}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={copyLink}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon name={copied ? 'check' : 'clipboard'} className="w-5 h-5" />
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button
                onClick={sendWhatsApp}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
            </div>

            <button
              onClick={closeModal}
              className="w-full py-3 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        {(status === 'pending' || status === 'viewed') && (
          <>
            <button
              onClick={resendDocument}
              disabled={loading}
              className="btn-primary w-auto px-6 flex items-center gap-2"
            >
              <Icon name="refresh" className="w-4 h-4" />
              {loading ? 'Gerando...' : 'Gerar novo link'}
            </button>
            <button
              onClick={cancelDocument}
              disabled={loading}
              className="btn-secondary w-auto px-6 flex items-center gap-2"
            >
              <Icon name="x" className="w-4 h-4" />
              Cancelar
            </button>
          </>
        )}
        {(status === 'expired' || status === 'cancelled') && (
          <button
            onClick={resendDocument}
            disabled={loading}
            className="btn-primary w-auto px-6 flex items-center gap-2"
          >
            <Icon name="refresh" className="w-4 h-4" />
            {loading ? 'Gerando...' : 'Reenviar documento'}
          </button>
        )}
      </div>
    </>
  )
}
