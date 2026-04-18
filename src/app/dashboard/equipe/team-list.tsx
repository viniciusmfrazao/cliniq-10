'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PermissionsModal from './permissions-modal'
import Icon from '@/components/ui/Icon'

type Member = {
  id: string
  name: string
  email: string
  role: string
  permissions?: string[]
  created_at: string
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

export default function TeamList({ members, currentUserId, clinicId }: { members: Member[]; currentUserId: string; clinicId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [removing, setRemoving] = useState<string | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<Member | null>(null)

  async function handleRemove(memberId: string) {
    if (!confirm('Tem certeza que deseja remover este membro?')) return
    
    setRemoving(memberId)
    
    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Erro ao remover membro')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao remover membro')
    }
    
    setRemoving(null)
    router.refresh()
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">Nenhum membro na equipe ainda.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {members.map(member => (
          <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-brand-700 text-sm font-semibold">
                  {member.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {member.name}
                  {member.id === currentUserId && <span className="text-slate-400 ml-1">(você)</span>}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[member.role] || 'bg-violet-100 text-violet-700'}`}>
              {ROLE_LABELS[member.role] || member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
              {member.id !== currentUserId && (
                <>
                  <button
                    onClick={() => setEditingPermissions(member)}
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    title="Permissões"
                  >
                    <Icon name="settings" className="w-4 h-4" />
                  </button>
                  {member.role !== 'admin' && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={removing === member.id}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      {removing === member.id ? '...' : 'Remover'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {editingPermissions && (
        <PermissionsModal
          member={editingPermissions}
          onClose={() => setEditingPermissions(null)}
          onSave={() => {
            setEditingPermissions(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
