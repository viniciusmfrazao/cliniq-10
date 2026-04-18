'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModuleSelector from '@/components/admin/ModuleSelector'
import { type ModuleId } from '@/lib/modules'

type Props = {
  clinicId: string
  activeModules: ModuleId[]
}

export default function ClinicModulesEditor({ clinicId, activeModules }: Props) {
  const router = useRouter()
  const [modules, setModules] = useState<ModuleId[]>(activeModules)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const hasChanges = JSON.stringify(modules.sort()) !== JSON.stringify(activeModules.sort())

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }

      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar módulos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Módulos Ativos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure quais módulos essa clínica tem acesso
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              ✓ Salvo com sucesso
            </span>
          )}
          {error && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>
      </div>
      
      <ModuleSelector
        selectedModules={modules}
        onChange={setModules}
        disabled={saving}
      />
    </div>
  )
}
