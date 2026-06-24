import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import DocumentActions from './document-actions'
import DocumentLinkCard from './document-link-card'

export default async function DocumentoDetalhePage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: doc } = await supabase
    .from('documents_sent')
    .select('*, patients(name, email, phone), users(name), document_templates(questions)')
    .eq('id', id)
    .maybeSingle()

  if (!doc) redirect('/dashboard/documentos')

  // Fallback: se o doc não tiver perguntas salvas, usa as do template
  const questions: { id: string; text: string }[] =
    (doc.questions && (doc.questions as any[]).length > 0)
      ? doc.questions as any[]
      : ((doc as any).document_templates?.questions || [])
  const questionAnswers: Record<string, 'sim' | 'nao'> = (doc as any).question_answers || {}

  const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Aguardando assinatura' },
    viewed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Visualizado' },
    signed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Assinado' },
    expired: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Expirado' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' },
  }

  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending
  const signUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/assinar/${doc.sign_token}`

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/documentos" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="chevronLeft" className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{doc.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{(doc.patients as { name: string } | null)?.name}</p>
        </div>
        <span className={`text-sm px-4 py-2 rounded-full font-medium ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      <div className="grid gap-6">
        {/* Info */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Informacoes</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Paciente</p>
              <p className="font-medium text-slate-900">{(doc.patients as { name: string })?.name}</p>
            </div>
            <div>
              <p className="text-slate-500">Contato</p>
              <p className="font-medium text-slate-900">
                {(doc.patients as { email?: string; phone?: string })?.email || (doc.patients as { phone?: string })?.phone || '-'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Enviado por</p>
              <p className="font-medium text-slate-900">{(doc.users as { name: string } | null)?.name || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Data de envio</p>
              <p className="font-medium text-slate-900">
                {new Date(doc.sent_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            {doc.viewed_at && (
              <div>
                <p className="text-slate-500">Visualizado em</p>
                <p className="font-medium text-slate-900">
                  {new Date(doc.viewed_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            {doc.signed_at && (
              <div>
                <p className="text-slate-500">Assinado em</p>
                <p className="font-medium text-emerald-600 flex items-center gap-1">
                  <Icon name="check" className="w-4 h-4" />
                  {new Date(doc.signed_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            {doc.signature_ip && (
              <div>
                <p className="text-slate-500">IP da assinatura</p>
                <p className="font-medium text-slate-900 font-mono text-xs">{doc.signature_ip}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">Expira em</p>
              <p className="font-medium text-slate-900">
                {doc.expires_at
                  ? new Date(doc.expires_at).toLocaleDateString('pt-BR')
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Link */}
        {(doc.status === 'pending' || doc.status === 'viewed') && (
          <DocumentLinkCard 
            signUrl={signUrl} 
            patientName={(doc.patients as { name: string })?.name}
            patientPhone={(doc.patients as { phone?: string })?.phone}
            docName={doc.name}
          />
        )}

        {/* Content */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Conteudo do documento</h2>
          <div className="bg-slate-50 rounded-xl p-6 whitespace-pre-wrap font-mono text-sm text-slate-700 max-h-96 overflow-y-auto">
            {doc.content}
          </div>
        </div>

        {/* Signature */}
        {doc.signature_data && (
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Assinatura do paciente</h2>
            <div className="bg-white border border-slate-200 rounded-xl p-4 inline-block">
              <img
                src={doc.signature_data}
                alt="Assinatura"
                className="max-w-xs h-auto"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <DocumentActions 
          docId={doc.id} 
          status={doc.status}
          patientName={(doc.patients as { name: string })?.name}
          patientPhone={(doc.patients as { phone?: string })?.phone}
          docName={doc.name}
        />
      </div>
    </div>
  )
}
