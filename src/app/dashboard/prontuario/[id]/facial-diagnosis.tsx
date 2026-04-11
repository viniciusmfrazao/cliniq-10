'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type Props = {
  patientId: string
  patientName: string
  clinicId: string
  onClose: () => void
  onSave: () => void
}

type FacialArea = {
  id: string
  name: string
  x: number
  y: number
  treatment: 'botox' | 'filler' | 'both' | null
  units?: number
  ml?: number
  notes?: string
}

const FACIAL_AREAS: Omit<FacialArea, 'treatment' | 'units' | 'ml' | 'notes'>[] = [
  { id: 'forehead', name: 'Testa', x: 50, y: 12 },
  { id: 'glabella', name: 'Glabela', x: 50, y: 22 },
  { id: 'crow_left', name: 'Pés de galinha E', x: 18, y: 35 },
  { id: 'crow_right', name: 'Pés de galinha D', x: 82, y: 35 },
  { id: 'eyebrow_left', name: 'Sobrancelha E', x: 32, y: 28 },
  { id: 'eyebrow_right', name: 'Sobrancelha D', x: 68, y: 28 },
  { id: 'nose', name: 'Nariz', x: 50, y: 45 },
  { id: 'nasolabial_left', name: 'Bigode chinês E', x: 35, y: 58 },
  { id: 'nasolabial_right', name: 'Bigode chinês D', x: 65, y: 58 },
  { id: 'cheek_left', name: 'Maçã do rosto E', x: 25, y: 48 },
  { id: 'cheek_right', name: 'Maçã do rosto D', x: 75, y: 48 },
  { id: 'lips', name: 'Lábios', x: 50, y: 68 },
  { id: 'marionette_left', name: 'Marionete E', x: 38, y: 75 },
  { id: 'marionette_right', name: 'Marionete D', x: 62, y: 75 },
  { id: 'chin', name: 'Queixo', x: 50, y: 85 },
  { id: 'jawline_left', name: 'Mandíbula E', x: 22, y: 70 },
  { id: 'jawline_right', name: 'Mandíbula D', x: 78, y: 70 },
]

const TREATMENT_COLORS = {
  botox: 'bg-blue-500',
  filler: 'bg-pink-500',
  both: 'bg-violet-500',
}

export default function FacialDiagnosis({ patientId, patientName, clinicId, onClose, onSave }: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [step, setStep] = useState<'photo' | 'diagnosis' | 'protocol'>('photo')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [areas, setAreas] = useState<FacialArea[]>(
    FACIAL_AREAS.map(a => ({ ...a, treatment: null }))
  )
  const [generalNotes, setGeneralNotes] = useState('')
  const [viewMode, setViewMode] = useState<'diagram' | 'photo'>('diagram')

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    const fileExt = file.name.split('.').pop()
    const fileName = `${patientId}/facial_${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('patient-photos')
      .upload(fileName, file)

    if (uploadError) {
      alert('Erro ao fazer upload: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('patient-photos')
      .getPublicUrl(fileName)

    setPhotoUrl(publicUrl)
    setUploading(false)
    setStep('diagnosis')
  }

  function updateArea(areaId: string, updates: Partial<FacialArea>) {
    setAreas(prev => prev.map(a => 
      a.id === areaId ? { ...a, ...updates } : a
    ))
  }

  function getSelectedAreas() {
    return areas.filter(a => a.treatment !== null)
  }

  function calculateTotals() {
    const selected = getSelectedAreas()
    const totalBotox = selected.reduce((sum, a) => sum + (a.units || 0), 0)
    const totalFiller = selected.reduce((sum, a) => sum + (a.ml || 0), 0)
    return { totalBotox, totalFiller }
  }

  async function handleSave() {
    setSaving(true)

    const diagnosis = {
      clinic_id: clinicId,
      patient_id: patientId,
      photo_url: photoUrl,
      areas: getSelectedAreas(),
      general_notes: generalNotes,
      totals: calculateTotals(),
      created_at: new Date().toISOString()
    }

    // Salvar como evolução especial
    const { error } = await supabase.from('evolutions').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      type: 'facial_diagnosis',
      content: `**Diagnóstico Facial**\n\n${generateProtocolText()}`,
      metadata: diagnosis
    })

    if (error) {
      alert('Erro ao salvar: ' + error.message)
    } else {
      onSave()
    }

    setSaving(false)
  }

  function generateProtocolText() {
    const selected = getSelectedAreas()
    const { totalBotox, totalFiller } = calculateTotals()
    
    let text = ''
    
    if (selected.some(a => a.treatment === 'botox' || a.treatment === 'both')) {
      text += '**Botox:**\n'
      selected
        .filter(a => a.treatment === 'botox' || a.treatment === 'both')
        .forEach(a => {
          text += `- ${a.name}: ${a.units || 0} unidades\n`
        })
      text += `\n*Total Botox: ${totalBotox} unidades*\n\n`
    }

    if (selected.some(a => a.treatment === 'filler' || a.treatment === 'both')) {
      text += '**Preenchedor:**\n'
      selected
        .filter(a => a.treatment === 'filler' || a.treatment === 'both')
        .forEach(a => {
          text += `- ${a.name}: ${a.ml || 0} ml\n`
        })
      text += `\n*Total Preenchedor: ${totalFiller} ml*\n\n`
    }

    if (generalNotes) {
      text += `**Observações:**\n${generalNotes}`
    }

    return text
  }

  const selectedAreaData = areas.find(a => a.id === selectedArea)
  const { totalBotox, totalFiller } = calculateTotals()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Diagnóstico Facial</h2>
            <p className="text-sm text-slate-500">{patientName}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Steps */}
            <div className="flex items-center gap-1 mr-4">
              {['photo', 'diagnosis', 'protocol'].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s ? 'bg-violet-600 text-white' : 
                    ['photo', 'diagnosis', 'protocol'].indexOf(step) > i ? 'bg-violet-100 text-violet-600' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                  {i < 2 && <div className="w-8 h-0.5 bg-slate-200" />}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Photo */}
          {step === 'photo' && (
            <div className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-4 bg-violet-100 rounded-full flex items-center justify-center">
                  <Icon name="camera" className="w-10 h-10 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Foto do Paciente
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Faça upload de uma foto frontal do rosto para análise. 
                  A foto será usada para marcar as áreas de tratamento.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-primary px-8 py-3 text-base"
                >
                  {uploading ? 'Enviando...' : 'Selecionar Foto'}
                </button>

                <button
                  onClick={() => setStep('diagnosis')}
                  className="block mx-auto mt-4 text-sm text-slate-500 hover:text-slate-700"
                >
                  Continuar sem foto →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Diagnosis */}
          {step === 'diagnosis' && (
            <div className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Face Diagram */}
                <div className="relative">
                  {photoUrl && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setViewMode('diagram')}
                        className={`px-3 py-1 text-sm rounded-lg ${viewMode === 'diagram' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        Diagrama
                      </button>
                      <button
                        onClick={() => setViewMode('photo')}
                        className={`px-3 py-1 text-sm rounded-lg ${viewMode === 'photo' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        Foto
                      </button>
                    </div>
                  )}

                  <div className="relative aspect-[3/4] bg-slate-100 rounded-2xl overflow-hidden">
                    {viewMode === 'photo' && photoUrl ? (
                      <img src={photoUrl} alt="Foto do paciente" className="w-full h-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 100 130" className="w-full h-full">
                        {/* Face outline */}
                        <ellipse cx="50" cy="55" rx="40" ry="50" fill="#fde8d8" stroke="#e5c7b3" strokeWidth="0.5" />
                        {/* Hair */}
                        <path d="M15 40 Q10 20 30 10 Q50 0 70 10 Q90 20 85 40" fill="#8B4513" />
                        {/* Eyes */}
                        <ellipse cx="35" cy="38" rx="8" ry="4" fill="white" stroke="#333" strokeWidth="0.3" />
                        <ellipse cx="65" cy="38" rx="8" ry="4" fill="white" stroke="#333" strokeWidth="0.3" />
                        <circle cx="35" cy="38" r="2" fill="#4a3728" />
                        <circle cx="65" cy="38" r="2" fill="#4a3728" />
                        {/* Eyebrows */}
                        <path d="M25 32 Q35 28 45 32" fill="none" stroke="#5c4033" strokeWidth="1" />
                        <path d="M55 32 Q65 28 75 32" fill="none" stroke="#5c4033" strokeWidth="1" />
                        {/* Nose */}
                        <path d="M50 42 L48 55 Q50 58 52 55 L50 42" fill="none" stroke="#d4a88a" strokeWidth="0.5" />
                        {/* Mouth */}
                        <path d="M40 70 Q50 75 60 70" fill="none" stroke="#c97878" strokeWidth="1" />
                        <path d="M42 68 Q50 72 58 68" fill="#e8a0a0" />
                      </svg>
                    )}

                    {/* Markers */}
                    {areas.map(area => (
                      <button
                        key={area.id}
                        onClick={() => setSelectedArea(area.id)}
                        style={{ left: `${area.x}%`, top: `${area.y}%` }}
                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                          area.treatment 
                            ? `w-5 h-5 ${TREATMENT_COLORS[area.treatment]} rounded-full border-2 border-white shadow-lg`
                            : selectedArea === area.id
                              ? 'w-4 h-4 bg-violet-300 rounded-full border-2 border-violet-600'
                              : 'w-3 h-3 bg-white/80 rounded-full border border-slate-300 hover:bg-violet-200 hover:border-violet-400'
                        }`}
                        title={area.name}
                      >
                        {area.treatment && (
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-700 whitespace-nowrap bg-white px-1 rounded">
                            {area.treatment === 'botox' || area.treatment === 'both' ? `${area.units || 0}u` : ''}
                            {area.treatment === 'both' ? ' + ' : ''}
                            {area.treatment === 'filler' || area.treatment === 'both' ? `${area.ml || 0}ml` : ''}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex justify-center gap-4 mt-3">
                    <div className="flex items-center gap-1 text-xs">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Botox</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <div className="w-3 h-3 rounded-full bg-pink-500" />
                      <span>Preenchedor</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      <span>Ambos</span>
                    </div>
                  </div>
                </div>

                {/* Area Details */}
                <div>
                  {selectedAreaData ? (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-slate-900">{selectedAreaData.name}</h3>
                      
                      <div>
                        <label className="label">Tratamento</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { value: null, label: 'Nenhum', color: 'bg-slate-100' },
                            { value: 'botox', label: 'Botox', color: 'bg-blue-100 text-blue-700' },
                            { value: 'filler', label: 'Preenchedor', color: 'bg-pink-100 text-pink-700' },
                            { value: 'both', label: 'Ambos', color: 'bg-violet-100 text-violet-700' },
                          ].map(opt => (
                            <button
                              key={opt.value || 'none'}
                              onClick={() => updateArea(selectedAreaData.id, { treatment: opt.value as any })}
                              className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                selectedAreaData.treatment === opt.value
                                  ? `${opt.color} ring-2 ring-offset-2 ring-violet-500`
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(selectedAreaData.treatment === 'botox' || selectedAreaData.treatment === 'both') && (
                        <div>
                          <label className="label">Unidades de Botox</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="30"
                              step="2"
                              value={selectedAreaData.units || 0}
                              onChange={e => updateArea(selectedAreaData.id, { units: Number(e.target.value) })}
                              className="flex-1"
                            />
                            <span className="w-16 text-center font-mono text-lg">{selectedAreaData.units || 0}u</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>0</span>
                            <span>30 unidades</span>
                          </div>
                        </div>
                      )}

                      {(selectedAreaData.treatment === 'filler' || selectedAreaData.treatment === 'both') && (
                        <div>
                          <label className="label">ML de Preenchedor</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.1"
                              value={selectedAreaData.ml || 0}
                              onChange={e => updateArea(selectedAreaData.id, { ml: Number(e.target.value) })}
                              className="flex-1"
                            />
                            <span className="w-16 text-center font-mono text-lg">{(selectedAreaData.ml || 0).toFixed(1)}ml</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>0</span>
                            <span>3 ml</span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="label">Observações da área</label>
                        <textarea
                          className="input"
                          rows={2}
                          value={selectedAreaData.notes || ''}
                          onChange={e => updateArea(selectedAreaData.id, { notes: e.target.value })}
                          placeholder="Notas específicas..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <Icon name="target" className="w-12 h-12 mx-auto mb-2" />
                        <p>Clique em uma área do rosto para configurar</p>
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  {getSelectedAreas().length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-violet-50 to-pink-50 rounded-xl">
                      <h4 className="font-semibold text-slate-900 mb-3">Resumo do Protocolo</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {totalBotox > 0 && (
                          <div className="text-center p-3 bg-white rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{totalBotox}u</p>
                            <p className="text-xs text-slate-500">Botox</p>
                          </div>
                        )}
                        {totalFiller > 0 && (
                          <div className="text-center p-3 bg-white rounded-lg">
                            <p className="text-2xl font-bold text-pink-600">{totalFiller.toFixed(1)}ml</p>
                            <p className="text-xs text-slate-500">Preenchedor</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        {getSelectedAreas().length} áreas selecionadas
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Protocol */}
          {step === 'protocol' && (
            <div className="p-6">
              <div className="max-w-2xl mx-auto">
                <h3 className="font-semibold text-slate-900 mb-4">Protocolo de Tratamento</h3>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                    <p className="text-3xl font-bold text-blue-700">{totalBotox}u</p>
                    <p className="text-sm text-blue-600">Total Botox</p>
                  </div>
                  <div className="card p-4 bg-gradient-to-br from-pink-50 to-pink-100">
                    <p className="text-3xl font-bold text-pink-700">{totalFiller.toFixed(1)}ml</p>
                    <p className="text-sm text-pink-600">Total Preenchedor</p>
                  </div>
                </div>

                {/* Detailed List */}
                <div className="space-y-3 mb-6">
                  {getSelectedAreas().map(area => (
                    <div key={area.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${TREATMENT_COLORS[area.treatment!]}`} />
                        <span className="font-medium text-slate-900">{area.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {(area.treatment === 'botox' || area.treatment === 'both') && (
                          <span className="text-blue-600 font-medium">{area.units}u botox</span>
                        )}
                        {(area.treatment === 'filler' || area.treatment === 'both') && (
                          <span className="text-pink-600 font-medium">{area.ml}ml filler</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* General Notes */}
                <div>
                  <label className="label">Observações Gerais</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={generalNotes}
                    onChange={e => setGeneralNotes(e.target.value)}
                    placeholder="Recomendações, cuidados pós-procedimento, próxima sessão..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-between">
          <button
            onClick={() => {
              if (step === 'diagnosis') setStep('photo')
              else if (step === 'protocol') setStep('diagnosis')
            }}
            disabled={step === 'photo'}
            className="btn-secondary px-6 disabled:opacity-50"
          >
            Voltar
          </button>
          
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary px-6">
              Cancelar
            </button>
            
            {step === 'protocol' ? (
              <button
                onClick={handleSave}
                disabled={saving || getSelectedAreas().length === 0}
                className="btn-primary px-6"
              >
                {saving ? 'Salvando...' : 'Salvar Diagnóstico'}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (step === 'photo') setStep('diagnosis')
                  else if (step === 'diagnosis') setStep('protocol')
                }}
                disabled={step === 'diagnosis' && getSelectedAreas().length === 0}
                className="btn-primary px-6"
              >
                Próximo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
