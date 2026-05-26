'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

type Professional = { id: string; name: string }

type Block = {
  id: string
  title: string
  start_time: string
  end_time: string
  notes: string | null
  color: string
  professional_id: string
  professional?: { name: string } | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  professionals: Professional[]
  clinicId: string
  selectedDate: string
  selectedHour?: number
  selectedProfessionalId?: string
  editBlock?: Block | null
}

const COLOR_OPTIONS = [
  { value: 'slate',  label: 'Cinza',    bg: 'bg-slate-400' },
  { value: 'red',    label: 'Vermelho', bg: 'bg-red-400' },
  { value: 'orange', label: 'Laranja',  bg: 'bg-orange-400' },
  { value: 'amber',  label: 'Amarelo',  bg: 'bg-amber-400' },
  { value: 'blue',   label: 'Azul',     bg: 'bg-blue-400' },
  { value: 'purple', label: 'Roxo',     bg: 'bg-purple-400' },
]

const TIME_SLOTS = Array.from({ length: 30 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2,'0')}:${m}`
})

export default function BlockModal({ isOpen, onClose, professionals, clinicId, selectedDate, selectedHour, selectedProfessionalId, editBlock }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const defaultStart = selectedHour ? `${String(selectedHour).padStart(2,'0')}:00` : '09:00'
  const defaultEnd = selectedHour ? `${String(selectedHour + 1).padStart(2,'0')}:00` : '10:00'

  const [form, setForm] = useState({
    title: editBlock?.title || '',
    date: editBlock ? editBlock.start_time.split('T')[0] : selectedDate,
    startTime: editBlock ? new Date(editBlock.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : defaultStart,
    endTime: editBlock ? new Date(editBlock.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : defaultEnd,
    notes: editBlock?.notes || '',
    color: editBlock?.color || 'slate',
    professionalId: editBlock?.professional_id || selectedProfessionalId || professionals[0]?.id || '',
  })

  if (!isOpen) return null

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Informe o título do compromisso'); return }
    if (!form.professionalId) { toast.error('Selecione a profissional'); return }
    setSaving(true)
    try {
      const startISO = new Date(`${form.date}T${form.startTime}:00-03:00`).toISOString()
      const endISO   = new Date(`${form.date}T${form.endTime}:00-03:00`).toISOString()

      if (editBlock) {
        const { error } = await supabase.from('professional_blocks').update({
          title: form.title.trim(), start_time: startISO, end_time: endISO,
          notes: form.notes || null, color: form.color, professional_id: form.professionalId,
        }).eq('id', editBlock.id)
        if (error) throw error
        toast.success('Compromisso atualizado')
      } else {
        const { error } = await supabase.from('professional_blocks').insert({
          clinic_id: clinicId, professional_id: form.professionalId,
          title: form.title.trim(), start_time: startISO, end_time: endISO,
          notes: form.notes || null, color: form.color,
        })
        if (error) throw error
        toast.success('Compromisso criado — horário bloqueado')
      }
      router.refresh()
      onClose()
    } catch (e: any) {
      toast.error('Erro ao salvar', { description: e.message })
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!editBlock) return
    if (!confirm('Remover este bloqueio?')) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('professional_blocks').delete().eq('id', editBlock.id)
      if (error) throw error
      toast.success('Bloqueio removido')
      router.refresh()
      onClose()
    } catch (e: any) {
      toast.error('Erro ao remover', { description: e.message })
    } finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <Icon name="lock" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">{editBlock ? 'Editar compromisso' : 'Bloquear horário'}</h2>
              <p className="text-xs text-slate-500">Compromisso pessoal — agenda bloqueada</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <Icon name="x" className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Profissional */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Profissional</label>
            <select
              value={form.professionalId}
              onChange={e => setForm(f => ({ ...f, professionalId: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
            >
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título do compromisso</label>
            <input
              type="text"
              placeholder="Ex: Consulta médica, Reunião, Almoço..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
            />
          </div>

          {/* Data + Horários */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Início</label>
              <select
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
              >
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fim</label>
              <select
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
              >
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cor</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className={`w-8 h-8 rounded-full ${c.bg} transition-all ${form.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações <span className="text-slate-400">(opcional)</span></label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Detalhes do compromisso..."
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-none"
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 mt-6">
          {editBlock && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              {deleting ? <span className="animate-spin w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full" /> : <Icon name="trash" className="w-4 h-4" />}
              Remover
            </button>
          )}
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-200"
          >
            {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Icon name="check" className="w-4 h-4" />}
            {editBlock ? 'Salvar' : 'Bloquear horário'}
          </button>
        </div>
      </div>
    </div>
  )
}
