'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

type PatientNote = {
  id: string
  content: string
  pinned: boolean
  created_at: string
  updated_at: string
  author_id: string | null
  users: { name: string } | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} · ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })}`
}

export default function PatientNotes({
  notes,
  patientId,
  clinicId,
  userId,
}: {
  notes: PatientNote[]
  patientId: string
  clinicId: string
  userId: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [error, setError] = useState('')

  const pinned = notes.filter((n) => n.pinned)
  const others = notes.filter((n) => !n.pinned)

  async function handleAdd() {
    const content = draft.trim()
    if (!content) return
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('patient_notes').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      author_id: userId,
      content,
    })

    if (insertError) {
      setError(`Erro ao salvar: ${insertError.message}`)
      setSaving(false)
      return
    }

    setDraft('')
    setSaving(false)
    router.refresh()
  }

  async function togglePin(note: PatientNote) {
    const { error: updateError } = await supabase
      .from('patient_notes')
      .update({ pinned: !note.pinned, updated_at: new Date().toISOString() })
      .eq('id', note.id)

    if (updateError) {
      setError(`Erro ao fixar: ${updateError.message}`)
      return
    }
    router.refresh()
  }

  function startEdit(note: PatientNote) {
    setEditingId(note.id)
    setEditDraft(note.content)
  }

  async function saveEdit(noteId: string) {
    const content = editDraft.trim()
    if (!content) return

    const { error: updateError } = await supabase
      .from('patient_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', noteId)

    if (updateError) {
      setError(`Erro ao editar: ${updateError.message}`)
      return
    }

    setEditingId(null)
    setEditDraft('')
    router.refresh()
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Excluir esta anotação?')) return

    const { error: deleteError } = await supabase.from('patient_notes').delete().eq('id', noteId)

    if (deleteError) {
      setError(`Erro ao excluir: ${deleteError.message}`)
      return
    }
    router.refresh()
  }

  function renderNote(note: PatientNote) {
    const isEditing = editingId === note.id
    return (
      <div
        key={note.id}
        className={`p-4 rounded-xl border ${
          note.pinned ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-transparent'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
              {note.users?.name ? initials(note.users.name) : '?'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">
                {note.users?.name || 'Usuário'}
              </p>
              <p className="text-xs text-slate-400">
                {formatDateTime(note.created_at)}
                {note.updated_at !== note.created_at && ' · editado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => togglePin(note)}
              title={note.pinned ? 'Desafixar' : 'Fixar'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                note.pinned
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <Icon name="pin" className="w-3.5 h-3.5" />
            </button>
            {!isEditing && (
              <button
                type="button"
                onClick={() => startEdit(note)}
                title="Editar"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <Icon name="edit" className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDelete(note.id)}
              title="Excluir"
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 flex items-center justify-center text-slate-600 hover:text-red-600"
            >
              <Icon name="trash" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              className="input w-full min-h-[80px] text-sm"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveEdit(note.id)}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
        )}
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Anotações</h2>

      <div className="mb-4">
        <textarea
          className="input w-full min-h-[70px] text-sm"
          placeholder="Escrever uma anotação..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {draft.trim() && (
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="btn-primary px-4 py-1.5 text-xs"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setDraft('')}
              className="btn-secondary px-4 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma anotação ainda.</p>
      ) : (
        <div className="space-y-2">
          {[...pinned, ...others].map(renderNote)}
        </div>
      )}
    </div>
  )
}
