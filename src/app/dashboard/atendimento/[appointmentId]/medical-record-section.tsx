'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Icon from '@/components/ui/Icon'

type Props = {
  patient: { id: string; name: string }
  appointmentId: string
  pastAppointments: Array<{
    id: string
    start_time: string
    status: string
    procedures: { name: string }[] | { name: string } | null
  }>
  medicalRecords: Array<{
    id: string
    type: string
    title: string
    content: string
    created_at: string
  }>
  clinicId: string
  professionalId: string
}

export default function MedicalRecordSection({ 
  patient, 
  appointmentId, 
  pastAppointments, 
  medicalRecords,
  clinicId,
  professionalId 
}: Props) {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  
  const [form, setForm] = useState({
    complaint: '',
    conduct: '',
    observations: ''
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos(prev => [...prev, event.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const saveMedicalRecord = async () => {
    if (!form.complaint && !form.conduct && !form.observations) {
      alert('Preencha pelo menos um campo do prontuário')
      return
    }

    setSaving(true)

    try {
      const content = [
        form.complaint && `**Queixa:**\n${form.complaint}`,
        form.conduct && `**Conduta:**\n${form.conduct}`,
        form.observations && `**Observações:**\n${form.observations}`,
        photos.length > 0 && `**Fotos:** ${photos.length} anexada(s)`
      ].filter(Boolean).join('\n\n')

      await supabase.from('evolutions').insert({
        clinic_id: clinicId,
        patient_id: patient.id,
        type: 'consulta',
        title: `Atendimento ${new Date().toLocaleDateString('pt-BR')}`,
        content,
        created_by: professionalId
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar prontuário')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'current' 
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon name="edit" className="w-4 h-4 inline mr-2" />
          Consulta Atual
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'history' 
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon name="clock" className="w-4 h-4 inline mr-2" />
          Histórico ({medicalRecords.length})
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'current' ? (
          <div className="space-y-4">
            {/* Queixa */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Queixa principal
              </label>
              <textarea
                value={form.complaint}
                onChange={e => setForm({ ...form, complaint: e.target.value })}
                placeholder="O que trouxe a paciente hoje..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all resize-none"
                rows={3}
              />
            </div>

            {/* Conduta */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Conduta / Procedimento realizado
              </label>
              <textarea
                value={form.conduct}
                onChange={e => setForm({ ...form, conduct: e.target.value })}
                placeholder="Descreva o procedimento realizado..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all resize-none"
                rows={4}
              />
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Observações
              </label>
              <textarea
                value={form.observations}
                onChange={e => setForm({ ...form, observations: e.target.value })}
                placeholder="Notas adicionais, recomendações..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all resize-none"
                rows={3}
              />
            </div>

            {/* Upload de Fotos */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Fotos antes/depois
              </label>
              <div className="flex flex-wrap gap-3">
                {photos.map((photo, i) => (
                  <div key={i} className="relative group">
                    <img 
                      src={photo} 
                      alt={`Foto ${i + 1}`} 
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon name="x" className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-slate-50 transition-colors">
                  <Icon name="camera" className="w-5 h-5 text-slate-400" />
                  <span className="text-xs text-slate-400 mt-1">Adicionar</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Botão Salvar */}
            <button
              onClick={saveMedicalRecord}
              disabled={saving}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                saved 
                  ? 'bg-emerald-500 text-white' 
                  : 'btn-primary'
              }`}
            >
              {saving ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : saved ? (
                <>
                  <Icon name="check" className="w-5 h-5" />
                  Salvo!
                </>
              ) : (
                <>
                  <Icon name="check" className="w-5 h-5" />
                  Salvar prontuário
                </>
              )}
            </button>
          </div>
        ) : (
          /* Histórico */
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {medicalRecords.length === 0 ? (
              <div className="text-center py-8">
                <Icon name="file" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum registro anterior</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

                {medicalRecords.map((record, i) => (
                  <div key={record.id} className="relative pl-10 pb-6 last:pb-0">
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-[var(--color-primary)] ring-4 ring-white" />
                    
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase">
                          {record.type}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(record.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-1">{record.title}</h4>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-4">
                        {record.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Consultas anteriores */}
            {pastAppointments.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3">Consultas anteriores</h4>
                <div className="space-y-2">
                  {pastAppointments.map(apt => (
                    <div key={apt.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">
                        {Array.isArray(apt.procedures) ? apt.procedures[0]?.name : apt.procedures?.name || 'Consulta'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(apt.start_time).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
