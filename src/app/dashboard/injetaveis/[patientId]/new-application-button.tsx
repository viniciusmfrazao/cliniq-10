'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FaceMapEditor from './face-map-editor'

type Props = {
  patientId: string
  clinicId: string
  professionalId: string
  professionalName: string
}

export default function NewApplicationButton({ patientId, clinicId, professionalId, professionalName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'toxin',
    product_name: '',
    product_brand: '',
    lot_number: '',
    notes: '',
    application_date: new Date().toISOString().split('T')[0],
  })
  const [points, setPoints] = useState<any[]>([])

  async function handleSubmit() {
    if (!form.product_name) return
    setLoading(true)

    // Calcular total de unidades
    const totalUnits = points.reduce((sum, p) => sum + (p.units || 0), 0)

    // Criar aplicacao
    const { data: application, error } = await supabase
      .from('injectable_applications')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        application_date: form.application_date,
        type: form.type,
        product_name: form.product_name,
        product_brand: form.product_brand || null,
        lot_number: form.lot_number || null,
        total_units: totalUnits,
        notes: form.notes || null,
      })
      .select()
      .single()

    if (error || !application) {
      console.error(error)
      setLoading(false)
      return
    }

    // Criar pontos
    if (points.length > 0) {
      await supabase.from('injectable_points').insert(
        points.map(p => ({
          application_id: application.id,
          zone: p.zone,
          muscle: p.muscle || null,
          side: p.side || null,
          x_position: p.x,
          y_position: p.y,
          units: p.units || null,
          depth: p.depth || null,
          technique: p.technique || null,
        }))
      )
    }

    setLoading(false)
    setOpen(false)
    setStep(1)
    setForm({
      type: 'toxin',
      product_name: '',
      product_brand: '',
      lot_number: '',
      notes: '',
      application_date: new Date().toISOString().split('T')[0],
    })
    setPoints([])
    router.refresh()
  }

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)} 
        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-200"
      >
        + Nova aplicacao
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Nova aplicacao</h2>
              <p className="text-purple-200 text-sm">Passo {step} de 2</p>
            </div>
            <button 
              onClick={() => setOpen(false)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'toxin' })}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    form.type === 'toxin' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-slate-200 hover:border-purple-200'
                  }`}
                >
                  <span className="text-4xl mb-3 block">💉</span>
                  <p className="font-semibold text-slate-900">Toxina Botulinica</p>
                  <p className="text-xs text-slate-500 mt-1">Botox, Dysport, Xeomin...</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'filler' })}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    form.type === 'filler' 
                      ? 'border-pink-500 bg-pink-50' 
                      : 'border-slate-200 hover:border-pink-200'
                  }`}
                >
                  <span className="text-4xl mb-3 block">✨</span>
                  <p className="font-semibold text-slate-900">Preenchedor</p>
                  <p className="text-xs text-slate-500 mt-1">Acido hialuronico, Radiesse...</p>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Produto *</label>
                  <input
                    className="input"
                    placeholder={form.type === 'toxin' ? 'Ex: Botox 100U' : 'Ex: Juvederm Voluma'}
                    value={form.product_name}
                    onChange={e => setForm({ ...form, product_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Marca</label>
                  <input
                    className="input"
                    placeholder="Ex: Allergan"
                    value={form.product_brand}
                    onChange={e => setForm({ ...form, product_brand: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Lote</label>
                  <input
                    className="input"
                    placeholder="Numero do lote"
                    value={form.lot_number}
                    onChange={e => setForm({ ...form, lot_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Data da aplicacao</label>
                  <input
                    type="date"
                    className="input"
                    value={form.application_date}
                    onChange={e => setForm({ ...form, application_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Observacoes</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Notas sobre a aplicacao..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <FaceMapEditor 
              points={points} 
              setPoints={setPoints} 
              type={form.type}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary w-auto px-6"
            >
              ← Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary w-auto px-6"
            >
              Cancelar
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!form.product_name}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2.5 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
            >
              Proximo: Marcar pontos →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2.5 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Salvando...' : `Salvar aplicacao (${points.length} pontos)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
