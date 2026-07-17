import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import DocumentsList from './documents-list'

export default async function DocumentosPage() {
  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  // Buscar templates
  const { data: templates } = await supabase
    .from('document_templates')
    .select('*')
    .eq('clinic_id', userData?.clinic_id)
    .eq('is_active', true)
    .order('name')

  // Buscar documentos enviados recentes
  const { data: recentDocs } = await supabase
    .from('documents_sent')
    .select('*, patients(name), document_templates(name)')
    .eq('clinic_id', userData?.clinic_id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Stats
  const { count: pending } = await supabase
    .from('documents_sent')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .eq('status', 'pending')

  const { count: signed } = await supabase
    .from('documents_sent')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', userData?.clinic_id)
    .eq('status', 'signed')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Termos e contratos para assinatura</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/documentos/recibo" className="btn-secondary w-auto px-4 flex items-center gap-2">
            <Icon name="file" className="w-4 h-4" />
            Recibo
          </Link>
          <Link href="/dashboard/documentos/templates" className="btn-secondary w-auto px-4 flex items-center gap-2">
            <Icon name="file" className="w-4 h-4" />
            Templates
          </Link>
          <Link href="/dashboard/documentos/enviar" className="btn-primary w-auto px-4 flex items-center gap-2">
            <Icon name="share" className="w-4 h-4" />
            Enviar documento
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon name="clock" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{pending || 0}</p>
              <p className="text-xs text-slate-500">Aguardando</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Icon name="check" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{signed || 0}</p>
              <p className="text-xs text-slate-500">Assinados</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Icon name="file" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{templates?.length || 0}</p>
              <p className="text-xs text-slate-500">Templates</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Icon name="share" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{recentDocs?.length || 0}</p>
              <p className="text-xs text-slate-500">Enviados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Receita/exame com validade em farmácia (CFM/CFO) */}
      <div className="card p-5 mb-6 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Receita e pedido de exame com validade em farmácia</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Os documentos que você assina aqui no Clinike são assinatura eletrônica simples — válidos como
              atestado/orientação, mas não substituem receita de medicamento controlado. Para isso, use a plataforma
              oficial e gratuita do seu conselho (exige certificado digital ICP-Brasil próprio).
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <a
              href="https://prescricaoeletronica.cfm.org.br"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full sm:w-auto px-4 flex items-center justify-center gap-2 text-sm whitespace-nowrap"
            >
              CRM — Prescrição CFM
            </a>
            <a
              href="https://prescricao.cfo.org.br"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full sm:w-auto px-4 flex items-center justify-center gap-2 text-sm whitespace-nowrap"
            >
              CRO — Prescrição CFO
            </a>
          </div>
        </div>
      </div>

      {/* Lista de documentos */}
      <DocumentsList documents={recentDocs || []} />
    </div>
  )
}
