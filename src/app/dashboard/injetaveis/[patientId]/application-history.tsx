'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FaceMapView from './face-map-view'
import Icon from '@/components/ui/Icon'

type Point = {
  id: string
  zone: string
  muscle: string | null
  side: string | null
  x_position: number
  y_position: number
  units: number | null
  depth: string | null
  technique: string | null
}

type Application = {
  id: string
  application_date: string
  type: string
  product_name: string
  product_brand: string | null
  lot_number: string | null
  total_units: number | null
  notes: string | null
  product_id: string | null
  stock_deducted: boolean | null
  users: { name: string } | null
  injectable_points: Point[]
}

export default function ApplicationHistory({
  applications: initialApplications,
  patientId,
  clinicId,
  patientGender = 'female'
}: {
  applications: Application[]
  patientId: string
  clinicId: string
  patientGender?: 'female' | 'male'
}) {
  const router = useRouter()
  const supabase = createClient()

  const [applications, setApplications] = useState<Application[]>(initialApplications)
  const [selectedApp, setSelectedApp] = useState<Application | null>(initialApplications[0] || null)

  // Estado de edição
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    product_name: '',
    product_brand: '',
    lot_number: '',
    total_units: 0,
    application_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  function startEdit(app: Application, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(app.id)
    setEditForm({
      product_name: app.product_name,
      product_brand: app.product_brand || '',
      lot_number: app.lot_number || '',
      total_units: app.total_units || 0,
      application_date: app.application_date,
      notes: app.notes || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(app: Application) {
    setSaving(true)
    try {
      const oldUnits = app.total_units || 0
      const newUnits = editForm.total_units
      const unitsDiff = newUnits - oldUnits

      const { error } = await supabase
        .from('injectable_applications')
        .update({
          product_name: editForm.product_name,
          product_brand: editForm.product_brand || null,
          lot_number: editForm.lot_number || null,
          total_units: newUnits,
          application_date: editForm.application_date,
          notes: editForm.notes || null,
        })
        .eq('id', app.id)

      if (error) throw error

      // Se tinha produto vinculado e stock_deducted, ajustar estoque
      if (app.product_id && app.stock_deducted && unitsDiff !== 0) {
        const { data: productData } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', app.product_id)
          .single()

        if (productData) {
          const { data: { user } } = await supabase.auth.getUser()
          const currentStock = productData.current_stock
          // unitsDiff > 0 = usou mais = deduz mais; < 0 = usou menos = devolve
          const newStock = Math.max(0, currentStock - unitsDiff)

          await supabase.from('stock_movements').insert({
            clinic_id: clinicId,
            product_id: app.product_id,
            type: unitsDiff > 0 ? 'uso_atendimento' : 'entrada',
            quantity: Math.abs(unitsDiff),
            previous_stock: currentStock,
            new_stock: newStock,
            reason: 'Ajuste por edição de aplicação',
            user_id: user?.id,
          })
        }
      }

      const updated = {
        ...app,
        product_name: editForm.product_name,
        product_brand: editForm.product_brand || null,
        lot_number: editForm.lot_number || null,
        total_units: newUnits,
        application_date: editForm.application_date,
        notes: editForm.notes || null,
      }
      setApplications(prev => prev.map(a => a.id === app.id ? updated : a))
      if (selectedApp?.id === app.id) setSelectedApp(updated)
      setEditingId(null)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar edição.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteApplication(app: Application, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Excluir aplicação de "${app.product_name}"? O estoque será revertido.`)) return
    setDeleting(app.id)

    try {
      // Reverter estoque se tinha produto vinculado
      if (app.product_id && app.stock_deducted && (app.total_units || 0) > 0) {
        const { data: productData } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', app.product_id)
          .single()

        if (productData) {
          const { data: { user } } = await supabase.auth.getUser()
          const newStock = productData.current_stock + (app.total_units || 0)

          await supabase.from('stock_movements').insert({
            clinic_id: clinicId,
            product_id: app.product_id,
            type: 'entrada',
            quantity: app.total_units,
            previous_stock: productData.current_stock,
            new_stock: newStock,
            reason: 'Estorno por exclusão de aplicação',
            user_id: user?.id,
          })
        }
      }

      // Deletar pontos e aplicação
      await supabase.from('injectable_points').delete().eq('application_id', app.id)
      const { error } = await supabase.from('injectable_applications').delete().eq('id', app.id)
      if (error) throw error

      const remaining = applications.filter(a => a.id !== app.id)
      setApplications(remaining)
      if (selectedApp?.id === app.id) setSelectedApp(remaining[0] || null)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir aplicação.')
    } finally {
      setDeleting(null)
    }
  }

  if (applications.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">💉</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Nenhuma aplicacao registrada</h3>
        <p className="text-sm text-slate-500 mb-6">Clique em "Nova aplicacao" para criar o primeiro mapa de injetaveis</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Lista de aplicacoes */}
      <div className="lg:col-span-1">
        <div className="card overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Historico</h2>
            <p className="text-xs text-slate-500">{applications.length} aplicacoes</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {applications.map(app => {
              const isEditing = editingId === app.id
              const isDeleting = deleting === app.id
              const isSelected = selectedApp?.id === app.id

              return (
                <div
                  key={app.id}
                  className={`border-l-4 transition-colors ${
                    isSelected ? 'border-purple-500 bg-purple-50' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  {isEditing ? (
                    /* Modo edição */
                    <div className="p-4 space-y-3">
                      <p className="text-xs font-semibold text-purple-700">Editar aplicação</p>
                      <div>
                        <label className="text-xs text-slate-500">Produto</label>
                        <input
                          className="input mt-0.5 text-sm"
                          value={editForm.product_name}
                          onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">Marca</label>
                          <input
                            className="input mt-0.5 text-sm"
                            value={editForm.product_brand}
                            onChange={e => setEditForm(f => ({ ...f, product_brand: e.target.value }))}
                            placeholder="Marca"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Unidades</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className="input mt-0.5 text-sm"
                            value={editForm.total_units}
                            onChange={e => setEditForm(f => ({ ...f, total_units: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">Lote</label>
                          <input
                            className="input mt-0.5 text-sm"
                            value={editForm.lot_number}
                            onChange={e => setEditForm(f => ({ ...f, lot_number: e.target.value }))}
                            placeholder="Lote"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Data</label>
                          <input
                            type="date"
                            className="input mt-0.5 text-sm"
                            value={editForm.application_date}
                            onChange={e => setEditForm(f => ({ ...f, application_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Observações</label>
                        <textarea
                          className="input mt-0.5 text-sm min-h-[60px]"
                          value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Observações..."
                        />
                      </div>
                      {app.product_id && app.stock_deducted && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                          ⚠️ Produto vinculado ao estoque — a diferença de unidades será ajustada automaticamente.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(app)}
                          disabled={saving}
                          className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                        >
                          {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Modo visualização */
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          app.type === 'toxin' ? 'bg-purple-100' : 'bg-pink-100'
                        }`}>
                          <span className="text-sm">{app.type === 'toxin' ? '💉' : '✨'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{app.product_name}</p>
                          <p className="text-xs text-slate-500">
                            {app.total_units} {app.type === 'toxin' ? 'U' : 'ml'} • {app.injectable_points.length} pontos
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(app.application_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        {/* Botões ação */}
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          <button
                            onClick={(e) => startEdit(app, e)}
                            className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-500 transition-colors"
                            title="Editar"
                          >
                            <Icon name="edit" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => deleteApplication(app, e)}
                            disabled={isDeleting}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            {isDeleting
                              ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                              : <Icon name="trash" className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Visualizacao do mapa */}
      <div className="lg:col-span-2">
        {selectedApp && (
          <div className="card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{selectedApp.product_name}</h2>
                  <p className="text-xs text-slate-500">
                    {new Date(selectedApp.application_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${selectedApp.type === 'toxin' ? 'text-purple-600' : 'text-pink-600'}`}>
                    {selectedApp.total_units} {selectedApp.type === 'toxin' ? 'U' : 'ml'}
                  </p>
                  <p className="text-xs text-slate-500">{selectedApp.injectable_points.length} pontos</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <FaceMapView points={selectedApp.injectable_points} type={selectedApp.type} gender={patientGender} />
            </div>

            {/* Detalhes */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">Produto</p>
                  <p className="font-medium text-slate-900">{selectedApp.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Marca</p>
                  <p className="font-medium text-slate-900">{selectedApp.product_brand || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Lote</p>
                  <p className="font-medium text-slate-900">{selectedApp.lot_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Profissional</p>
                  <p className="font-medium text-slate-900">{selectedApp.users?.name || '-'}</p>
                </div>
              </div>
              {selectedApp.notes && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-400 mb-1">Observacoes</p>
                  <p className="text-sm text-slate-600">{selectedApp.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
