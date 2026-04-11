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
  doctor: 'Medico(a)',
  esthetician: 'Esteticista',
  receptionist: 'Recepcionista',
  viewer: 'Visualizador',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  esthetician: 'bg-pink-100 text-pink-700',
  receptionist: 'bg-green-100 text-green-700',
  viewer: 'bg-slate-100 text-slate-700',
}

export default function TeamList({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [removing, setRemoving] = useState<string | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<Member | null>(null)

  async function handleRemove(memberId: string) {
    if (!confirm('Tem certeza que deseja remover este membro?')) return
    
    setRemoving(memberId)
    
    await supabase.from('users').delete().eq('id', memberId)
    
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
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[member.role] || ROLE_COLORS.viewer}`}>
                {ROLE_LABELS[member.role] || member.role}
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
