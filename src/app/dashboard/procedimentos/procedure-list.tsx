'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import ProcedureForm from './procedure-form'
import ResultadosEvaTab from './ResultadosEvaTab'

type Professional = { id: string; name: string; role?: string }

type Procedure = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  category: string | null
  active: boolean
  professional_ids: string[] | null
  includes_return: boolean | null
  return_days: number | null
}

type Props = {
  procedures: Procedure[]
  professionals: Professional[]
  clinicId: string
  isAdmin: boolean
  hasEva?: boolean
}

export default function ProcedureList({ procedures, professionals, clinicId, isAdmin, hasEva = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<Procedure | null>(null)
  const [activeTab, setActiveTab] = useState<'dados' | 'resultados'>('dados')

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      // Conta referencias em paralelo (head:true so traz o count, sem dados)
      const [apptRes, entradaRes, leadRes, waitRes] = await Promise.all([
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('procedure_id', id),
        supabase.from('entradas').select('id', { count: 'exact', head: true }).eq('procedimento_id', id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('procedure_id', id),
        supabase.from('waiting_list').select('id', { count: 'exact', head: true }).eq('procedure_id', id),
      ])

      const totalRefs =
        (apptRes.count || 0) + (entradaRes.count || 0) + (leadRes.count || 0) + (waitRes.count || 0)

      if (totalRefs > 0) {
        const partes: string[] = []
        if (apptRes.count) partes.push(`${apptRes.count} agendamento(s)`)
        if (entradaRes.count) partes.push(`${entradaRes.count} venda(s)`)
        if (leadRes.count) partes.push(`${leadRes.count} lead(s)`)
        if (waitRes.count) partes.push(`${waitRes.count} na fila de espera`)

        const msg =
          `Este procedimento esta vinculado a:\n  • ${partes.join('\n  • ')}\n\n` +
          `Por isso nao pode ser excluido (apagaria o historico).\n\n` +
          `Deseja DESATIVAR no lugar? Ele some das listas de novo agendamento mas o historico fica preservado.`

        if (confirm(msg)) {
          await supabase.from('procedures').update({ active: false }).eq('id', id)
          router.refresh()
        }
        return
      }

      if (!confirm('Excluir este procedimento? Esta acao nao pode ser desfeita.')) return

      const { error } = await supabase.from('procedures').delete().eq('id', id)
      if (error) {
        alert('Nao foi possivel excluir: ' + error.message)
        return
      }
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('procedures').update({ active: !active }).eq('id', id)
    router.refresh()
  }

  const profMap = new Map(professionals.map(p => [p.id, p.name]))
  function firstName(full: string) {
    return (full.startsWith('Dra.') || full.startsWith('Dr.'))
      ? full.split(' ').slice(0, 2).join(' ')
      : full.split(' ')[0]
  }

  if (procedures.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">Nenhum procedimento cadastrado</p>
      </div>
    )
  }

  const grouped = procedures.reduce((acc, proc) => {
    const cat = proc.category || 'Sem categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(proc)
    return acc
  }, {} as Record<string, Procedure[]>)

  return (
    <>
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, procs]) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {category}
            </h3>
            <div className="space-y-2">
              {procs.map(proc => {
                const profIds = proc.professional_ids || []
                const profNames = profIds
                  .map(id => profMap.get(id))
                  .filter(Boolean) as string[]
                const allDoIt = profIds.length === 0

                return (
                  <div
                    key={proc.id}
                    className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${
                      proc.active ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{proc.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {proc.duration_minutes} min • R$ {Number(proc.price).toFixed(2)}
                        {proc.includes_return && proc.return_days != null && (
                          <> • retorno {proc.return_days}d</>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        {allDoIt ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Qualquer profissional
                          </span>
                        ) : profNames.length > 0 ? (
                          profNames.map(name => (
                            <span
                              key={name}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100"
                            >
                              {firstName(name)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                            Nenhum profissional vinculado
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditing(proc)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Icon name="edit" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(proc.id, proc.active)}
                          className={`text-xs px-2 py-1 rounded ${
                            proc.active
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {proc.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDelete(proc.id)}
                          disabled={deleting === proc.id}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                        >
                          {deleting === proc.id ? '...' : 'Excluir'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pt-16 pb-24 px-4 md:p-4 md:pb-4 bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-full md:max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Editar procedimento</h2>
                <p className="text-xs text-slate-500">{editing.name}</p>
              </div>
              <button
                onClick={() => { setEditing(null); setActiveTab('dados') }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {/* Abas — só mostra Resultados EVA se a clínica tiver o módulo */}
            {hasEva && (
              <div className="flex border-b border-slate-100 dark:border-slate-700 px-4">
                <button
                  onClick={() => setActiveTab('dados')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'dados'
                      ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Dados
                </button>
                <button
                  onClick={() => setActiveTab('resultados')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'resultados'
                      ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon name="robot" className="w-4 h-4" />
                  Resultados EVA
                </button>
              </div>
            )}

            {/* Conteúdo */}
            <div className="p-4">
              {activeTab === 'dados' ? (
                <ProcedureForm
                  clinicId={clinicId}
                  professionals={professionals}
                  procedure={editing}
                  onSaved={() => { setEditing(null); setActiveTab('dados') }}
                  onCancel={() => { setEditing(null); setActiveTab('dados') }}
                />
              ) : (
                <ResultadosEvaTab
                  clinicId={clinicId}
                  procedureId={editing.id}
                  procedureName={editing.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
