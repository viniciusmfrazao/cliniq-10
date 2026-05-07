'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import {
  PERMISSION_GROUPS,
  COLOR_STYLES,
  ROLE_LABELS,
  FACTORY_DEFAULTS,
} from '@/lib/permissions'

type Props = {
  role: string
  initialPermissions: string[]
  isCustom: boolean
}

export default function RoleDefaultsForm({ role, initialPermissions, isCustom }: Props) {
  const router = useRouter()
  const [permissions, setPermissions] = useState<string[]>(initialPermissions)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const hasAll = permissions.includes('all')

  const isDirty = useMemo(() => {
    if (initialPermissions.length !== permissions.length) return true
    const a = [...initialPermissions].sort().join(',')
    const b = [...permissions].sort().join(',')
    return a !== b
  }, [initialPermissions, permissions])

  function togglePermission(permId: string) {
    if (hasAll) return
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    )
  }

  function toggleGroupAll(groupPermIds: string[]) {
    if (hasAll) return
    const allSelected = groupPermIds.every((id) => permissions.includes(id))
    setPermissions((prev) => {
      if (allSelected) return prev.filter((p) => !groupPermIds.includes(p))
      const next = new Set(prev)
      for (const id of groupPermIds) next.add(id)
      return Array.from(next)
    })
  }

  function toggleAll() {
    if (hasAll) {
      setPermissions(FACTORY_DEFAULTS[role] ?? [])
    } else {
      setPermissions(['all'])
    }
  }

  function applyFactory() {
    if (!confirm(`Restaurar padrão de fábrica para "${ROLE_LABELS[role] ?? role}"?`)) return
    setPermissions(FACTORY_DEFAULTS[role] ?? [])
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSavedAt(null)

    try {
      const r = await fetch('/api/config/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      })
      const data = await r.json()
      if (!r.ok || !data.ok) {
        setError(data.error || `Falha (HTTP ${r.status})`)
        return
      }
      setSavedAt(new Date())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  async function handleRestoreFactory() {
    if (!confirm(
      `Voltar essa função para o padrão de fábrica?\n\n` +
      `Isso vai apagar a customização salva e voltar ao padrão original do sistema. ` +
      `Membros já cadastrados não são afetados (suas permissões individuais permanecem).`,
    )) return

    setRestoring(true)
    setError(null)

    try {
      const r = await fetch('/api/config/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions: FACTORY_DEFAULTS[role] ?? [] }),
      })
      const data = await r.json()
      if (!r.ok || !data.ok) {
        setError(data.error || `Falha (HTTP ${r.status})`)
        return
      }
      setPermissions(FACTORY_DEFAULTS[role] ?? [])
      setSavedAt(new Date())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      {/* Acesso total */}
      <button
        type="button"
        onClick={toggleAll}
        className={`w-full card p-5 text-left transition-all ${
          hasAll
            ? 'bg-gradient-to-br from-violet-50 to-pink-50 border-violet-200 ring-2 ring-violet-200'
            : 'hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              hasAll ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Icon name="shield" className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className={`font-semibold ${hasAll ? 'text-violet-900' : 'text-slate-900'}`}>
              Acesso total
            </p>
            <p className={`text-sm ${hasAll ? 'text-violet-700' : 'text-slate-500'}`}>
              Liberar todas as áreas. Use só pra cargos que realmente precisam de tudo.
            </p>
          </div>
          <div
            className={`w-12 h-7 rounded-full relative transition-colors ${
              hasAll ? 'bg-violet-500' : 'bg-slate-200'
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                hasAll ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </div>
        </div>
      </button>

      <div className={`space-y-4 ${hasAll ? 'opacity-50 pointer-events-none' : ''}`}>
        {PERMISSION_GROUPS.map((group) => {
          const styles = COLOR_STYLES[group.color]
          const groupPermIds = group.permissions.map((p) => p.id)
          const selectedCount = groupPermIds.filter((id) => permissions.includes(id)).length
          const allSelected = selectedCount === groupPermIds.length
          const noneSelected = selectedCount === 0

          return (
            <div key={group.id} className="card overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-xl ${styles.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon name={group.icon} className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{group.label}</p>
                  <p className="text-xs text-slate-500">{group.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroupAll(groupPermIds)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    allSelected
                      ? `${styles.soft} ${styles.text}`
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {noneSelected ? 'Marcar todas' : allSelected ? 'Tudo liberado' : `${selectedCount}/${groupPermIds.length}`}
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {group.permissions.map((perm) => {
                  const checked = hasAll || permissions.includes(perm.id)
                  return (
                    <label
                      key={perm.id}
                      className={`flex items-start gap-4 p-4 cursor-pointer transition-colors ${
                        checked ? styles.soft : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(perm.id)}
                        disabled={hasAll}
                        className={`mt-0.5 w-5 h-5 rounded border-slate-300 ${styles.text} focus:ring-2 focus:ring-offset-0 ${styles.ring}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{perm.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{perm.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={applyFactory}
          className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1.5"
        >
          <Icon name="refresh" className="w-3.5 h-3.5" />
          Aplicar padrão de fábrica
        </button>
        <span className="text-xs text-slate-400">
          {hasAll ? 'Todas liberadas' : `${permissions.length} permissões selecionadas`}
        </span>
      </div>

      {isCustom && (
        <div className="mt-3 px-1">
          <button
            type="button"
            onClick={handleRestoreFactory}
            disabled={restoring}
            className="text-xs text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {restoring ? (
              <Icon name="loader" className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Icon name="trash" className="w-3.5 h-3.5" />
            )}
            Voltar ao padrão original (apaga customização salva)
          </button>
        </div>
      )}

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white/95 backdrop-blur border-t border-slate-200 p-4 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {error && (
            <span className="flex-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
              {error}
            </span>
          )}
          {savedAt && !error && (
            <span className="flex-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg inline-flex items-center gap-1.5">
              <Icon name="check" className="w-3.5 h-3.5" />
              Salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!error && !savedAt && <div className="flex-1" />}
          <Link
            href="/dashboard/config/permissoes"
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium"
          >
            Voltar
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <Icon name="loader" className="w-4 h-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Icon name="check" className="w-4 h-4" />
                Salvar padrão
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
