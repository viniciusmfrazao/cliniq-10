'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Document = {
  id: string
  name: string
  status: string
  created_at: string
  signed_at: string | null
  patients: { name: string } | null
  document_templates: { name: string } | null
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Documento enviado', icon: 'share' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Aguardando', icon: 'clock' },
  viewed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Visualizado', icon: 'eye' },
  signed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Assinado', icon: 'check' },
  expired: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Expirado', icon: 'clock' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado', icon: 'x' },
}

export default function DocumentsList({ documents }: { documents: Document[] }) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' 
    ? documents 
    : documents.filter(d => d.status === filter)

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Documentos enviados</h2>
        <div className="flex gap-2">
          {['all', 'pending', 'signed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'gradient-bg text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Aguardando' : 'Assinados'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Icon name="file" className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Nenhum documento encontrado</p>
          <Link href="/dashboard/documentos/enviar" className="btn-primary w-auto px-6 inline-flex items-center gap-2 mt-4">
            <Icon name="share" className="w-4 h-4" />
            Enviar documento
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {filtered.map(doc => {
            const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending
            return (
              <Link
                key={doc.id}
                href={`/dashboard/documentos/${doc.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${status.bg} flex items-center justify-center`}>
                  <Icon name={status.icon} className={`w-5 h-5 ${status.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{doc.name}</p>
                  <p className="text-sm text-slate-500 truncate">
                    {doc.patients?.name} • {doc.document_templates?.name || 'Documento'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Icon name="chevronRight" className="w-5 h-5 text-slate-300" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
