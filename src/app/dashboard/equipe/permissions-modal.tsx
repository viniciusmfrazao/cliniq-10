'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Member = {
  id: string
  name: string
  email: string
  role: string
  permissions?: string[]
}

type Props = {
  member: Member
  onClose: () => void
  onSave: () => void
}

const PERMISSION_GROUPS = [
  {
    label: 'Agenda',
    permissions: [
      { id: 'agenda_view', label: 'Ver agenda' },
      { id: 'agenda_edit', label: 'Criar/editar agendamentos' },
    ]
  },
  {
    label: 'Pacientes',
    permissions: [
      { id: 'patients_view', label: 'Ver pacientes' },
      { id: 'patients_edit', label: 'Cadastrar/editar pacientes' },
    ]
  },
  {
    label: 'Prontuário',
    permissions: [
      { id: 'records_view', label: 'Ver prontuários' },
      { id: 'records_edit', label: 'Escrever prontuários' },
    ]
  },
  {
    label: 'Estoque',
    permissions: [
      { id: 'stock_view', label: 'Ver estoque' },
      { id: 'stock_edit', label: 'Gerenciar estoque' },
    ]
  },
  {
    label: 'Financeiro',
    permissions: [
      { id: 'financial_view', label: 'Ver financeiro' },
      { id: 'financial_edit', label: 'Lançamentos financeiros' },
    ]
  },
  {
    label: 'CRM',
    permissions: [
      { id: 'crm_view', label: 'Ver leads' },
      { id: 'crm_edit', label: 'Gerenciar leads' },
    ]
  },
  {
    label: 'Sistema',
    permissions: [
      { id: 'team_manage', label: 'Gerenciar equipe' },
      { id: 'reports_view', label: 'Ver relatórios' },
      { id: 'settings', label: 'Configurações da clínica' },
    ]
  },
]

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ['all'],
  doctor: ['agenda_view', 'agenda_edit', 'patients_view', 'patients_edit', 'records_view', 'records_edit', 'stock_view'],
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

export default function PermissionsModal({ member, onClose, onSave }: Props) {
  const supabase = createClient()
  
  // Garantir que permissions seja sempre um array
  const getInitialPermissions = (): string[] => {
    if (Array.isArray(member.permissions)) {
      return member.permissions
    }
    return DEFAULT_PERMISSIONS[member.role] || []
  }
  
  const [permissions, setPermissions] = useState<string[]>(getInitialPermissions())
  const [saving, setSaving] = useState(false)

  const hasAll = Array.isArray(permissions) && permissions.includes('all')
  
  function togglePermission(permId: string) {
    if (hasAll) return
    setPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    )
  }

  function toggleAll() {
    if (hasAll) {
      setPermissions(DEFAULT_PERMISSIONS[member.role] || [])
    } else {
      setPermissions(['all'])
    }
  }

  async function handleSave() {
    setSaving(true)
    
    const { error } = await supabase
      .from('users')
      .update({ permissions })
      .eq('id', member.id)

    if (!error) {
      onSave()
    } else {
      alert('Erro ao salvar: ' + error.message)
    }
    
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Permissões</h2>
            <p className="text-sm text-slate-500">{member.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Acesso total */}
          <label className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={hasAll}
              onChange={toggleAll}
              className="w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <p className="font-medium text-violet-900">Acesso total</p>
              <p className="text-xs text-violet-600">Todas as permissões do sistema</p>
            </div>
          </label>

          {/* Grupos de permissões */}
          {PERMISSION_GROUPS.map(group => (
            <div key={group.label} className={hasAll ? 'opacity-50' : ''}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.permissions.map(perm => (
                  <label 
                    key={perm.id} 
                    className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={hasAll || permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      disabled={hasAll}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-sm text-slate-700">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 px-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
