'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import SchedulesModal from './schedules-modal'
import UnavailabilityModal from './unavailability-modal'
import Icon from '@/components/ui/Icon'

const PROFESSIONAL_ROLES = new Set([
  'doctor', 'biomedic', 'nurse', 'esthetician',
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

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  biomedic: 'bg-teal-100 text-teal-700',
  nurse: 'bg-cyan-100 text-cyan-700',
  esthetician: 'bg-pink-100 text-pink-700',
  physiotherapist: 'bg-orange-100 text-orange-700',
  nutritionist: 'bg-lime-100 text-lime-700',
  psychologist: 'bg-indigo-100 text-indigo-700',
  receptionist: 'bg-green-100 text-green-700',
  financial: 'bg-amber-100 text-amber-700',
  manager: 'bg-rose-100 text-rose-700',
  assistant: 'bg-sky-100 text-sky-700',
  viewer: 'bg-slate-100 text-slate-700',
}

export default function TeamList({ members, currentUserId, clinicId, showReactivate = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [editingSchedules, setEditingSchedules] = useState<Member | null>(null)
  const [editingUnavail, setEditingUnavail] = useState<Member | null>(null)

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
                <p className={`text-sm font-medium ${showReactivate ? 'text-slate-500' : 'text-slate-900'}`}>
                  {member.name}
                  {member.id === currentUserId && <span className="text-slate-400 ml-1">(você)</span>}
                </p>
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
                      {PROFESSIONAL_ROLES.has(member.role) && (
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
                      <Link
                        href={`/dashboard/equipe/${member.id}/permissoes`}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        title="Permissões"
                      >
                        <Icon name="settings" className="w-4 h-4" />
                      </Link>
                      {member.role !== 'admin' && (
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
