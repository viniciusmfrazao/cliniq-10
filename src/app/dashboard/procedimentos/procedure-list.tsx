'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Procedure = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  category: string | null
  active: boolean
}

export default function ProcedureList({ procedures, isAdmin }: { procedures: Procedure[]; isAdmin: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Excluir este procedimento?')) return
    setDeleting(id)
    await supabase.from('procedures').delete().eq('id', id)
    setDeleting(null)
    router.refresh()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('procedures').update({ active: !active }).eq('id', id)
    router.refresh()
  }

  if (procedures.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">Nenhum procedimento cadastrado</p>
      </div>
    )
  }

  // Agrupar por categoria
  const grouped = procedures.reduce((acc, proc) => {
    const cat = proc.category || 'Sem categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(proc)
    return acc
  }, {} as Record<string, Procedure[]>)

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, procs]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {category}
          </h3>
          <div className="space-y-2">
            {procs.map(proc => (
              <div 
                key={proc.id} 
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  proc.active ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{proc.name}</p>
                  <p className="text-xs text-slate-500">
                    {proc.duration_minutes} min • R$ {proc.price.toFixed(2)}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
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
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
