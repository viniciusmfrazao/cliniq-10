'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import SchedulesModal from './schedules-modal'
import UnavailabilityModal from './unavailability-modal'
import Icon from '@/components/ui/Icon'

const PROFESSIONAL_ROLES = new Set([
  'doctor', 'dentist', 'biomedic', 'nurse', 'esthetician',
  'physiotherapist', 'nutritionist', 'psychologist',
])

type Member = {
  id: string
  name: string
  email: string
  role: string
  active?: boolean
  permissions?: string[]
  created_at: string
}

type Props = {
  members: Member[]
  currentUserId: string
  clinicId: string
  showReactivate?: boolean
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  doctor: 'Médico(a)',
  dentist: 'Dentista',
  biomedic: 'Biomédico(a)',
  nurse: 'Enfermeiro(a)',
  esthetician: 'Esteticista',
  physiotherapist: 'Fisioterapeuta',
  nutritionist: 'Nutricionista',
  psychologist: 'Psicólogo(a)',
  receptionist: 'Recepcionista',
  financial: 'Financeiro',
  manager: 'Gerente',
  comercial: 'Comercial',
  assistant: 'Assistente',
  viewer: 'Visualizador',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  dentist: 'bg-sky-100 text-sky-800',
  biomedic: 'bg-teal-100 text-teal-700',
  nurse: 'bg-cyan-100 text-cyan-700',
  esthetician: 'bg-pink-100 text-pink-700',
  physiotherapist: 'bg-orange-100 text-orange-700',
  nutritionist: 'bg-lime-100 text-lime-700',
  psychologist: 'bg-indigo-100 text-indigo-700',
  receptionist: 'bg-green-100 text-green-700',
  financial: 'bg-amber-100 text-amber-700',
  manager: 'bg-rose-100 text-rose-700',
  comercial: 'bg-orange-100 text-orange-700',
  assistant: 'bg-sky-100 text-sky-700',
  viewer: 'bg-slate-100 text-slate-700',
}

export default function TeamList({ members, currentUserId, clinicId, showReactivate = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [editingSchedules, setEditingSchedules] = useState<Member | null>(null)
  const [editingUnavail, setEditingUnavail] = useState<Member | null>(null)
  const [editingProfRole, setEditingProfRole] = useState<string | null>(null)
  const [editingRegistration, setEditingRegistration] = useState<string | null>(null)
  const [registrationValue, setRegistrationValue] = useState('')
  const [savingRegistration, setSavingRegistration] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)

  const PROF_OPTIONS = [
    { value: '', label: 'Não atende pacientes' },
    { value: 'doctor', label: 'Médico(a)' },
    { value: 'dentist', label: 'Dentista' },
    { value: 'biomedic', label: 'Biomédico(a)' },
    { value: 'nurse', label: 'Enfermeiro(a)' },
    { value: 'esthetician', label: 'Esteticista' },
    { value: 'physiotherapist', label: 'Fisioterapeuta' },
    { value: 'nutritionist', label: 'Nutricionista' },
    { value: 'psychologist', label: 'Psicólogo(a)' },
  ]

  async function handleSaveProfRole(memberId: string, professional_role: string) {
    setLoading(memberId)
    try {
      await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, professional_role: professional_role || null })
      })
    } catch {}
    setLoading(null)
    setEditingProfRole(null)
    router.refresh()
  }

  async function handleSaveName(memberId: string) {
    if (!nameValue.trim()) return
    setSavingName(true)
    try {
      await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, name: nameValue.trim() })
      })
    } catch {}
    setSavingName(false)
    setEditingName(null)
    router.refresh()
  }

  async function handleSaveRegistration(memberId: string) {
    setSavingRegistration(true)
    try {
      await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, professional_registration: registrationValue.trim() })
      })
    } catch {}
    setSavingRegistration(false)
    setEditingRegistration(null)
    router.refresh()
  }

  async function handleDeactivate(memberId: string, memberName: string) {
    if (!confirm(`Desativar ${memberName}?\n\nO membro não poderá mais acessar o sistema, mas o histórico será mantido.`)) return
    
    setLoading(memberId)
    
    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      })

      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Erro ao desativar membro')
      } else {
        alert(data.message || 'Membro desativado com sucesso')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao desativar membro')
    }
    
    setLoading(null)
    router.refresh()
  }

  async function handleReactivate(memberId: string, memberName: string) {
    if (!confirm(`Reativar ${memberName}?\n\nO membro poderá acessar o sistema novamente.`)) return
    
    setLoading(memberId)
    
    try {
      const response = await fetch(`/api/team/${memberId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      })

      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Erro ao reativar membro')
      } else {
        alert(data.message || 'Membro reativado com sucesso')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao reativar membro')
    }
    
    setLoading(null)
    router.refresh()
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">
          {showReactivate ? 'Nenhum membro desativado.' : 'Nenhum membro na equipe ainda.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {members.map(member => (
          <div 
            key={member.id} 
            className={`flex items-center justify-between p-3 rounded-xl ${
              showReactivate ? 'bg-white border border-slate-200' : 'bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                showReactivate ? 'bg-slate-200' : 'bg-brand-100'
              }`}>
                <span className={`text-sm font-semibold ${showReactivate ? 'text-slate-500' : 'text-brand-700'}`}>
                  {member.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                {editingName === member.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveName(member.id)
                        if (e.key === 'Escape') setEditingName(null)
                      }}
                      className="text-sm border border-violet-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 w-44"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveName(member.id)}
                      disabled={savingName}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Salvar"
                    >
                      <Icon name="check" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingName(null)}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group/name">
                    <p className={`text-sm font-medium ${showReactivate ? 'text-slate-500' : 'text-slate-900'}`}>
                      {member.name}
                      {member.id === currentUserId && <span className="text-slate-400 ml-1">(você)</span>}
                    </p>
                    {!showReactivate && (
                      <button
                        onClick={() => { setEditingName(member.id); setNameValue(member.name) }}
                        className="opacity-0 group-hover/name:opacity-100 p-0.5 text-slate-300 hover:text-violet-500 transition-all rounded"
                        title="Editar nome"
                      >
                        <Icon name="edit" className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                showReactivate 
                  ? 'bg-slate-100 text-slate-500' 
                  : (ROLE_COLORS[member.role] || 'bg-violet-100 text-violet-700')
              }`}>
                {ROLE_LABELS[member.role] || member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              {(member as any).professional_role && (member as any).professional_role !== member.role && (
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-teal-100 text-teal-700">
                  {ROLE_LABELS[(member as any).professional_role] || (member as any).professional_role}
                </span>
              )}
              {editingProfRole === member.id ? (
                <div className="flex items-center gap-1">
                  <select
                    defaultValue={(member as any).professional_role || ''}
                    onChange={e => handleSaveProfRole(member.id, e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    autoFocus
                    onBlur={() => setEditingProfRole(null)}
                  >
                    {PROF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ) : (
                <button
                  onClick={() => setEditingProfRole(member.id)}
                  className="text-xs text-slate-400 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                  title="Definir papel clínico"
                >
                  {(member as any).professional_role ? '✏️' : '+ Clínico'}
                </button>
              )}

              {(member as any).professional_role && (
                editingRegistration === member.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={registrationValue}
                      onChange={e => setRegistrationValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveRegistration(member.id)
                        if (e.key === 'Escape') setEditingRegistration(null)
                      }}
                      placeholder="Ex: CRM 123456-SP"
                      className="text-xs border border-violet-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 w-32"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRegistration(member.id)}
                      disabled={savingRegistration}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Salvar"
                    >
                      <Icon name="check" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingRegistration(null)}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingRegistration(member.id)
                      setRegistrationValue((member as any).professional_registration || '')
                    }}
                    className="text-xs text-slate-400 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                    title="Registro no conselho (CRM/CRO/CRBM/COREN...)"
                  >
                    {(member as any).professional_registration || '+ CRM/CRO'}
                  </button>
                )
              )}
              
              {!showReactivate && (
                <>
                  <button
                    onClick={() => setEditingSchedules(member)}
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    title="Horários de atendimento"
                  >
                    <Icon name="clock" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingUnavail(member)}
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    title="Férias e folgas"
                  >
                    <Icon name="calendar" className="w-4 h-4" />
                  </button>
                </>
              )}
              {member.id !== currentUserId && (
                <>
                  {showReactivate ? (
                    // Botão de reativar
                    <button
                      onClick={() => handleReactivate(member.id, member.name)}
                      disabled={loading === member.id}
                      className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      {loading === member.id ? '...' : 'Reativar'}
                    </button>
                  ) : (
                    // Botões de editar e desativar
                    <>
                      <Link
                        href={`/dashboard/equipe/${member.id}/permissoes`}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        title="Permissões"
                      >
                        <Icon name="settings" className="w-4 h-4" />
                      </Link>
                      {member.role !== 'admin' && member.role !== 'super_admin' && (
                        <button
                          onClick={() => handleDeactivate(member.id, member.name)}
                          disabled={loading === member.id}
                          className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
                        >
                          {loading === member.id ? '...' : 'Desativar'}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {editingSchedules && (
        <SchedulesModal
          member={{ id: editingSchedules.id, name: editingSchedules.name }}
          clinicId={clinicId}
          onClose={() => setEditingSchedules(null)}
          onSave={() => router.refresh()}
        />
      )}

      {editingUnavail && (
        <UnavailabilityModal
          member={{ id: editingUnavail.id, name: editingUnavail.name }}
          clinicId={clinicId}
          onClose={() => setEditingUnavail(null)}
          onSave={() => router.refresh()}
        />
      )}
    </>
  )
}
