import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SignatureForm from './signature-form'

export default async function AssinarPage({ params }: { params: { token: string } }) {
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('documents_sent')
    .select('*, patients(name), clinics(name)')
    .eq('sign_token', params.token)
    .single()

  if (!doc) {
    notFound()
  }

  if (doc.status === 'signed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Documento ja assinado</h1>
          <p className="text-slate-600">
            Este documento foi assinado em{' '}
            {new Date(doc.signed_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
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
            Este link de assinatura expirou. Entre em contato com a clinica para solicitar um novo link.
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
            Este documento foi cancelado pela clinica.
          </p>
        </div>
      </div>
    )
  }

  // Mark as viewed
  if (doc.status === 'pending') {
    await supabase
      .from('documents_sent')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', doc.id)
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
            <span className="font-semibold text-slate-700">{(doc.clinics as { name: string })?.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{doc.name}</h1>
          <p className="text-slate-600">
            Ola, <strong>{(doc.patients as { name: string })?.name}</strong>
          </p>
        </div>

        <SignatureForm doc={doc} />
      </div>
    </div>
  )
}
