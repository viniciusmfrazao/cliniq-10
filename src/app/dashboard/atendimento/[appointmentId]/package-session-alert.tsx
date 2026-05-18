'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type ActivePackage = {
  id: string
  name: string
  total_sessions: number
  used_sessions: number
  status: string
}

export default function PackageSessionAlert({
  packages,
  clinicId,
  appointmentId,
}: {
  packages: ActivePackage[]
  clinicId: string
  appointmentId: string
}) {
  const [localPackages, setLocalPackages] = useState(packages)
  const [registering, setRegistering] = useState<string | null>(null) // package id
  const [done, setDone] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  if (localPackages.length === 0) return null

  async function handleUse(pkg: ActivePackage) {
    setRegistering(pkg.id)
    const supabase = createClient()
    const { error } = await supabase.from('patient_package_sessions').insert({
      clinic_id: clinicId,
      package_id: pkg.id,
      appointment_id: appointmentId,
      performed_at: new Date().toISOString().split('T')[0],
    })

    if (!error) {
      setDone(prev => new Set([...prev, pkg.id]))
      setLocalPackages(prev =>
        prev.map(p =>
          p.id === pkg.id
            ? { ...p, used_sessions: p.used_sessions + 1 }
            : p
        )
      )
    }
    setRegistering(null)
  }

  return (
    <div className="card p-5 border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <Icon name="box" className="w-4 h-4 text-violet-600" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">Pacotes ativos</h3>
      </div>

      <div className="space-y-2">
        {localPackages.map(pkg => {
          const remaining = pkg.total_sessions - pkg.used_sessions
          const isUsed = done.has(pkg.id)
          const isLoading = registering === pkg.id

          return (
            <div
              key={pkg.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all ${
                isUsed
                  ? 'bg-emerald-50 border border-emerald-100'
                  : 'bg-white border border-slate-100'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{pkg.name}</p>
                <p className="text-xs text-slate-400">
                  {isUsed
                    ? `✓ Sessão ${pkg.used_sessions} de ${pkg.total_sessions} registrada`
                    : `${remaining} sessão${remaining !== 1 ? 'ões' : ''} restante${remaining !== 1 ? 's' : ''} de ${pkg.total_sessions}`
                  }
                </p>
                {/* mini barra */}
                <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isUsed ? 'bg-emerald-400' : 'bg-violet-400'}`}
                    style={{
                      width: `${Math.min(((isUsed ? pkg.used_sessions : pkg.used_sessions) / pkg.total_sessions) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>

              {isUsed ? (
                <span className="text-xs font-semibold text-emerald-600 whitespace-nowrap flex items-center gap-1">
                  <Icon name="check" className="w-3.5 h-3.5" />
                  Usada
                </span>
              ) : (
                <button
                  onClick={() => handleUse(pkg)}
                  disabled={isLoading || remaining === 0}
                  className="flex-shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-xl disabled:opacity-50 transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  {isLoading ? '...' : 'Usar sessão'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
