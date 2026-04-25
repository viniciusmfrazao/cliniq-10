'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import FaceMapEditor from './face-map-editor'
import Icon from '@/components/ui/Icon'
import { todayBR } from '@/lib/datetime'

type Product = {
  id: string
  name: string
  brand: string | null
  current_stock: number
  batch_number: string | null
  unit: string
}

type Props = {
  patientId: string
  clinicId: string
  professionalId: string
  professionalName: string
  patientGender?: 'female' | 'male'
}

export default function NewApplicationButton({ patientId, clinicId, professionalId, professionalName, patientGender = 'female' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('appointment')
  const supabase = createClient()
  
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  
  const [form, setForm] = useState({
    type: 'toxin',
    product_id: '',
    product_name: '',
    product_brand: '',
    lot_number: '',
    notes: '',
    application_date: todayBR(),
  })
  const [points, setPoints] = useState<any[]>([])

  // Carregar produtos injetaveis do estoque
  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, name, brand, current_stock, batch_number, unit')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .eq('category', 'injetavel')
        .gt('current_stock', 0)
        .order('name')
      
      if (data) setProducts(data)
    }
    if (open) loadProducts()
  }, [open, clinicId, supabase])

  function selectProduct(productId: string) {
    const product = products.find(p => p.id === productId)
    if (product) {
      setForm({
        ...form,
        product_id: product.id,
        product_name: product.name,
        product_brand: product.brand || '',
        lot_number: product.batch_number || '',
      })
    }
  }

  async function handleSubmit() {
    if (!form.product_name) return
    setLoading(true)

    const totalUnits = points.reduce((sum, p) => sum + (p.units || 0), 0)

    // Criar aplicacao vinculada ao produto e atendimento
    const { data: application, error } = await supabase
      .from('injectable_applications')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        appointment_id: appointmentId || null,
        product_id: form.product_id || null,
        application_date: form.application_date,
        type: form.type,
        product_name: form.product_name,
        product_brand: form.product_brand || null,
        lot_number: form.lot_number || null,
        total_units: totalUnits,
        notes: form.notes || null,
        stock_deducted: false,
      })
      .select()
      .single()

    if (error || !application) {
      console.error(error)
      alert('Erro ao salvar aplicacao')
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
      product_id: '',
      product_name: '',
      product_brand: '',
      lot_number: '',
      notes: '',
      application_date: todayBR(),
    })
    setPoints([])
    router.refresh()
  }

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)} 
        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-2"
      >
        <Icon name="plus" className="w-4 h-4" />
        Nova aplicacao
      </button>
    )
  }

  const totalUnits = points.reduce((sum, p) => sum + (p.units || 0), 0)
  const selectedProduct = products.find(p => p.id === form.product_id)

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
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
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
              {/* Tipo */}
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

              {/* Selecionar do Estoque */}
              {products.length > 0 && (
                <div>
                  <label className="label">Selecionar do Estoque</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
                    {products.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => selectProduct(product.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.product_id === product.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-slate-200 hover:border-purple-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900 text-sm">{product.name}</p>
                          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                            {product.current_stock} {product.unit}
                          </span>
                        </div>
                        {product.brand && (
                          <p className="text-xs text-slate-500 mt-1">{product.brand}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    <Icon name="box" className="w-3 h-3 inline mr-1" />
                    O estoque sera descontado ao finalizar o atendimento
                  </p>
                </div>
              )}

              {/* Ou digitar manualmente */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">ou digite manualmente</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Produto *</label>
                  <input
                    className="input"
                    placeholder={form.type === 'toxin' ? 'Ex: Botox 100U' : 'Ex: Juvederm Voluma'}
                    value={form.product_name}
                    onChange={e => setForm({ ...form, product_name: e.target.value, product_id: '' })}
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
            <div>
              {/* Info do produto selecionado */}
              {selectedProduct && (
                <div className="mb-4 p-3 bg-purple-50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-medium text-purple-900">{selectedProduct.name}</p>
                    <p className="text-xs text-purple-600">Estoque: {selectedProduct.current_stock} {selectedProduct.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{totalUnits}U</p>
                    <p className="text-xs text-purple-500">marcadas</p>
                  </div>
                </div>
              )}
              <FaceMapEditor 
                points={points} 
                setPoints={setPoints} 
                type={form.type}
                gender={patientGender}
              />
            </div>
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
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2.5 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              Proximo: Marcar pontos
              <Icon name="arrowRight" className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || points.length === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2.5 rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Icon name="check" className="w-4 h-4" />
                  Salvar ({points.length} pontos, {totalUnits}U)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
