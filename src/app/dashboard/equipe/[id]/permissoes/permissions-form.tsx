'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Member = {
  id: string
  name: string
  email: string
  role: string
  permissions?: string[]
}

type Props = { member: Member; activeModules?: string[] }

type IconName =
  | 'calendar'
  | 'users'
  | 'file'
  | 'box'
  | 'dollarSign'
  | 'target'
  | 'settings'

type PermissionGroup = {
  id: string
  label: string
  description: string
  icon: IconName
  color: string
  requiredModule?: string
  permissions: { id: string; label: string; description: string }[]
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'agenda',
    label: 'Agenda',
    description: 'Visualização e gestão de agendamentos',
    icon: 'calendar',
    color: 'emerald',
    permissions: [
      { id: 'agenda_view', label: 'Ver agenda', description: 'Visualizar todos os agendamentos da clínica' },
      { id: 'agenda_edit', label: 'Criar/editar agendamentos', description: 'Marcar, remarcar, cancelar e mover horários' },
    ],
  },
  {
    id: 'pacientes',
    label: 'Pacientes',
    description: 'Cadastro e dados gerais',
    icon: 'users',
    color: 'blue',
    permissions: [
      { id: 'patients_view', label: 'Ver pacientes', description: 'Listar e abrir fichas de pacientes' },
      { id: 'patients_edit', label: 'Cadastrar/editar pacientes', description: 'Cadastrar novos pacientes e alterar dados de contato' },
    ],
  },
  {
    id: 'prontuario',
    label: 'Prontuário',
    description: 'Histórico clínico e atendimentos',
    icon: 'file',
    color: 'violet',
    permissions: [
      { id: 'records_view', label: 'Ver prontuários', description: 'Acessar histórico clínico, anamneses e evoluções' },
      { id: 'records_edit', label: 'Escrever prontuários', description: 'Registrar evoluções, anamneses e finalizar atendimentos' },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    description: 'Produtos e movimentações',
    icon: 'box',
    color: 'amber',
    permissions: [
      { id: 'stock_view', label: 'Ver estoque', description: 'Consultar quantidades e relatório de produtos' },
      { id: 'stock_edit', label: 'Gerenciar estoque', description: 'Entradas, saídas, ajustes e cadastro de produtos' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Recebimentos e despesas',
    icon: 'dollarSign',
    color: 'green',
    permissions: [
      { id: 'financial_view', label: 'Ver financeiro', description: 'Consultar entradas, saídas e relatórios' },
      { id: 'financial_edit', label: 'Lançamentos financeiros', description: 'Registrar pagamentos, despesas e baixar contas' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Leads e pipeline comercial',
    icon: 'target',
    color: 'pink',
    requiredModule: 'crm',
    permissions: [
      { id: 'crm_view', label: 'Ver leads', description: 'Visualizar pipeline e conversas com leads' },
      { id: 'crm_edit', label: 'Gerenciar leads', description: 'Mover etapa, atribuir responsáveis e responder conversas' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    description: 'Equipe, relatórios e configurações',
    icon: 'settings',
    color: 'slate',
    permissions: [
      { id: 'team_manage', label: 'Gerenciar equipe', description: 'Convidar, desativar e editar permissões de membros' },
      { id: 'reports_view', label: 'Ver relatórios', description: 'Acessar relatórios gerais da clínica' },
      { id: 'settings', label: 'Configurações da clínica', description: 'Alterar dados da clínica, automações e WhatsApp' },
    ],
  },
]

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ['all'],
  doctor: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  dentist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  biomedic: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  nurse: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
  esthetician: ['agenda_view', 'agenda_edit', 'patients_view', 'records_view', 'records_edit', 'stock_view'],
  physiotherapist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit'],
  nutritionist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit'],
  psychologist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit'],
  receptionist: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'crm_view', 'crm_edit'],
  financial: ['agenda_view', 'patients_view', 'financial_view', 'financial_edit', 'reports_view'],
  manager: ['agenda_view', 'agenda_edit', 'patients_view', 'stock_view', 'stock_edit', 'financial_view', 'reports_view', 'crm_view', 'crm_edit'],
  assistant: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit'],
  viewer: ['agenda_view', 'patients_view'],
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  doctor: 'Médico(a)',
  biomedic: 'Biomédico(a)',
  nurse: 'Enfermeiro(a)',
  esthetician: 'Esteticista',
  physiotherapist: 'Fisioterapeuta',
  nutritionist: 'Nutricionista',
  psychologist: 'Psicólogo(a)',
  receptionist: 'Recepcionista',
  financial: 'Financeiro',
  manager: 'Gerente',
  assistant: 'Assistente',
  viewer: 'Visualizador',
}

const COLOR_STYLES: Record<string, { bg: string; text: string; ring: string; soft: string }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-500', soft: 'bg-emerald-50' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-700', ring: 'ring-blue-500', soft: 'bg-blue-50' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-700', ring: 'ring-violet-500', soft: 'bg-violet-50' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-500', soft: 'bg-amber-50' },
  green: { bg: 'bg-green-500', text: 'text-green-700', ring: 'ring-green-500', soft: 'bg-green-50' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-700', ring: 'ring-pink-500', soft: 'bg-pink-50' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-700', ring: 'ring-slate-500', soft: 'bg-slate-50' },
}

export default function PermissionsForm({ member, activeModules = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const initialPerms = useMemo<string[]>(() => {
    if (Array.isArray(member.permissions)) return member.permissions
    return DEFAULT_PERMISSIONS[member.role] ?? []
  }, [member.permissions, member.role])

  const [permissions, setPermissions] = useState<string[]>(initialPerms)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasAll = permissions.includes('all')

  const isDirty = useMemo(() => {
    if (initialPerms.length !== permissions.length) return true
    const a = [...initialPerms].sort().join(',')
    const b = [...permissions].sort().join(',')
    return a !== b
  }, [initialPerms, permissions])

  function togglePermission(permId: string) {
    if (hasAll) return
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    )
  }

  function toggleGroupAll(group: PermissionGroup) {
    if (hasAll) return
    const allIds = group.permissions.map((p) => p.id)
    const allSelected = allIds.every((id) => permissions.includes(id))
    setPermissions((prev) => {
      if (allSelected) return prev.filter((p) => !allIds.includes(p))
      const next = new Set(prev)
      for (const id of allIds) next.add(id)
      return Array.from(next)
    })
  }

  function toggleAll() {
    if (hasAll) {
      setPermissions(DEFAULT_PERMISSIONS[member.role] ?? [])
    } else {
      setPermissions(['all'])
    }
  }

  function applyDefaults() {
    if (!confirm(`Restaurar permissões padrão do papel "${ROLE_LABELS[member.role] ?? member.role}"?`)) return
    setPermissions(DEFAULT_PERMISSIONS[member.role] ?? [])
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSavedAt(null)

    const { error: err } = await supabase
      .from('users')
      .update({ permissions })
      .eq('id', member.id)

    if (err) {
      setError(err.message)
    } else {
      setSavedAt(new Date())
      router.refresh()
    }

    setSaving(false)
  }

  return (
    <>
      <div className="card p-5 mb-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{member.name}</p>
          <p className="text-sm text-slate-500 truncate">{member.email}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
      </div>

      <button
        type="button"
        onClick={toggleAll}
        className={`w-full card p-5 mb-4 text-left transition-all ${
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
              Liberar todas as áreas do sistema. Ideal pra sócios e administradores.
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
        {PERMISSION_GROUPS.filter(group => !group.requiredModule || activeModules.length === 0 || activeModules.includes(group.requiredModule)).map((group) => {
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
                  onClick={() => toggleGroupAll(group)}
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
          onClick={applyDefaults}
          className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1.5"
        >
          <Icon name="refresh" className="w-3.5 h-3.5" />
          Restaurar padrão do papel
        </button>
        <span className="text-xs text-slate-400">
          {hasAll ? 'Todas liberadas' : `${permissions.length} permissões selecionadas`}
        </span>
      </div>

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
              Salvo às{' '}
              {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!error && !savedAt && <div className="flex-1" />}
          <Link
            href="/dashboard/equipe"
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
                Salvar permissões
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
