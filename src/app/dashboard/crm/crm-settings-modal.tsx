'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Stage = {
  id: string
  label: string
  color: string
  order: number
}

type Source = {
  id: string
  label: string
  icon: string
}

type Props = {
  clinicId: string
  /** Instância da linha de CRM ativa (null = bucket padrão/Eva). Define
   * em qual linha de crm_settings salvar quando a clínica tem CRM
   * dedicado por número. */
  whatsappInstance?: string | null
  currentStages: Stage[]
  currentSources: Source[]
  onClose: () => void
  onSave: () => void
}

const COLORS = [
  { id: 'slate', label: 'Cinza', class: 'bg-slate-500' },
  { id: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { id: 'violet', label: 'Violeta', class: 'bg-violet-500' },
  { id: 'amber', label: 'Amarelo', class: 'bg-amber-500' },
  { id: 'emerald', label: 'Verde', class: 'bg-emerald-500' },
  { id: 'red', label: 'Vermelho', class: 'bg-red-500' },
  { id: 'pink', label: 'Rosa', class: 'bg-pink-500' },
  { id: 'cyan', label: 'Ciano', class: 'bg-cyan-500' },
]

const ICONS = ['📸', '💬', '👥', '🔍', '📘', '🌐', '📞', '📧', '🏥', '📌', '⭐', '🎯']

export default function CRMSettingsModal({ clinicId, whatsappInstance = null, currentStages, currentSources, onClose, onSave }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<'stages' | 'sources' | 'followup'>('stages')
  const [stages, setStages] = useState<Stage[]>(currentStages)
  const [sources, setSources] = useState<Source[]>(currentSources)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // Follow-up settings
  const [followupDays, setFollowupDays] = useState(3)
  const [autoReminder, setAutoReminder] = useState(true)

  function addStage() {
    const newOrder = Math.max(...stages.map(s => s.order), -1) + 1
    setStages([...stages, {
      id: `stage_${Date.now()}`,
      label: 'Nova Etapa',
      color: 'slate',
      order: newOrder
    }])
  }

  function updateStage(index: number, field: keyof Stage, value: string | number) {
    const updated = [...stages]
    updated[index] = { ...updated[index], [field]: value }
    setStages(updated)
  }

  function removeStage(index: number) {
    if (stages.length <= 2) {
      alert('Mínimo de 2 etapas')
      return
    }
    setStages(stages.filter((_, i) => i !== index))
  }

  function moveStage(index: number, direction: 'up' | 'down') {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === stages.length - 1)) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...stages]
    const [removed] = updated.splice(index, 1)
    updated.splice(newIndex, 0, removed)
    updated.forEach((s, i) => s.order = i)
    setStages(updated)
  }

  function addSource() {
    setSources([...sources, {
      id: `source_${Date.now()}`,
      label: 'Nova Fonte',
      icon: '📌'
    }])
  }

  function updateSource(index: number, field: keyof Source, value: string) {
    const updated = [...sources]
    updated[index] = { ...updated[index], [field]: value }
    setSources(updated)
  }

  function removeSource(index: number) {
    if (sources.length <= 2) {
      alert('Mínimo de 2 fontes')
      return
    }
    setSources(sources.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    // Identifica a linha certa de crm_settings pela instância ativa —
    // clínica com CRM multi-linha tem 1 row por número, então "clinic_id"
    // sozinho não identifica qual editar (antes usava .single(), que
    // já dá erro com 2+ rows e fazia cair num insert que violava a
    // constraint de unicidade, falhando em silêncio).
    let query = supabase
      .from('crm_settings')
      .select('id')
      .eq('clinic_id', clinicId)
    query = whatsappInstance
      ? query.eq('whatsapp_instance', whatsappInstance)
      : query.is('whatsapp_instance', null)
    const { data: existing, error: fetchError } = await query.maybeSingle()

    if (fetchError) {
      setSaveError('Não consegui verificar as configurações existentes: ' + fetchError.message)
      setSaving(false)
      return
    }

    const settingsData = {
      clinic_id: clinicId,
      whatsapp_instance: whatsappInstance,
      custom_stages: stages,
      custom_sources: sources,
      whatsapp_followup_days: followupDays,
      eva_auto_suggest: autoReminder,
    }

    const { error: saveErr } = existing
      ? await supabase
          .from('crm_settings')
          .update(settingsData)
          .eq('id', existing.id)
      : await supabase
          .from('crm_settings')
          .insert(settingsData)

    setSaving(false)

    if (saveErr) {
      setSaveError('Não consegui salvar: ' + saveErr.message)
      return
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Configurações do CRM</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('stages')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'stages' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Etapas do Funil
          </button>
          <button
            onClick={() => setTab('sources')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'sources' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Fontes de Leads
          </button>
          <button
            onClick={() => setTab('followup')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'followup' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Follow-up
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Stages Tab */}
          {tab === 'stages' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">
                Configure as etapas do seu funil de vendas. Arraste para reordenar.
              </p>
              {stages.sort((a, b) => a.order - b.order).map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveStage(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <Icon name="chevronUp" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveStage(index, 'down')}
                      disabled={index === stages.length - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <Icon name="chevronDown" className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <select
                    value={stage.color}
                    onChange={e => updateStage(index, 'color', e.target.value)}
                    className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                  >
                    {COLORS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    value={stage.label}
                    onChange={e => updateStage(index, 'label', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                  
                  <button
                    onClick={() => removeStage(index)}
                    className="p-1.5 text-red-400 hover:text-red-600"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <button
                onClick={addStage}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
              >
                + Adicionar Etapa
              </button>
            </div>
          )}

          {/* Sources Tab */}
          {tab === 'sources' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">
                Configure as fontes de onde seus leads chegam.
              </p>
              {sources.map((source, index) => (
                <div key={source.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                  <select
                    value={source.icon}
                    onChange={e => updateSource(index, 'icon', e.target.value)}
                    className="w-16 px-2 py-1.5 text-center border border-slate-200 rounded-lg"
                  >
                    {ICONS.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    value={source.label}
                    onChange={e => updateSource(index, 'label', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                  
                  <button
                    onClick={() => removeSource(index)}
                    className="p-1.5 text-red-400 hover:text-red-600"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <button
                onClick={addSource}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
              >
                + Adicionar Fonte
              </button>
            </div>
          )}

          {/* Follow-up Tab */}
          {tab === 'followup' && (
            <div className="space-y-6">
              <p className="text-sm text-slate-500">
                Configure como você deseja acompanhar seus leads.
              </p>
              
              <div>
                <label className="label">Dias para follow-up automático</label>
                <p className="text-xs text-slate-500 mb-2">
                  Leads sem contato por este período serão destacados
                </p>
                <select
                  value={followupDays}
                  onChange={e => setFollowupDays(Number(e.target.value))}
                  className="input"
                >
                  <option value={1}>1 dia</option>
                  <option value={2}>2 dias</option>
                  <option value={3}>3 dias</option>
                  <option value={5}>5 dias</option>
                  <option value={7}>7 dias</option>
                  <option value={14}>14 dias</option>
                </select>
              </div>

              <label className="flex items-center gap-3 p-4 bg-violet-50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReminder}
                  onChange={e => setAutoReminder(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-violet-600"
                />
                <div>
                  <p className="font-medium text-violet-900">Sugestões automáticas</p>
                  <p className="text-xs text-violet-600">
                    Mostrar sugestões de ação para cada lead (preparado para Eva IA)
                  </p>
                </div>
              </label>

              <div className="p-4 bg-amber-50 rounded-xl">
                <p className="text-sm font-medium text-amber-800 mb-1">💡 Dica de Follow-up</p>
                <p className="text-xs text-amber-700">
                  O ideal é fazer contato em até 5 minutos após o lead chegar. 
                  Leads contactados rapidamente têm 9x mais chance de conversão!
                </p>
              </div>
            </div>
          )}
        </div>

        {saveError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700">
            {saveError}
          </div>
        )}
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
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}
