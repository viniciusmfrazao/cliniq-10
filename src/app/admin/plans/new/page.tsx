'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ModuleSelector from '@/components/admin/ModuleSelector'
import { type ModuleId } from '@/lib/modules'

export default function NewPlanPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modules, setModules] = useState<ModuleId[]>([])
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    max_professionals: '',
    max_whatsapp_numbers: '1',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price_monthly: parseFloat(form.price_monthly) || 0,
          price_yearly: form.price_yearly ? parseFloat(form.price_yearly) : null,
          max_professionals: form.max_professionals ? parseInt(form.max_professionals) : null,
          max_whatsapp_numbers: Math.max(1, parseInt(form.max_whatsapp_numbers) || 1),
          modules
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar plano')
      }

      router.push('/admin/plans')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar plano')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/plans"
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Voltar
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Plano</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Crie um novo plano com os módulos desejados
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações do Plano */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Informações do Plano
          </h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome do Plano *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Starter, Professional, Enterprise"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Descrição
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descrição curta do plano"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Preço Mensal (R$) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={form.price_monthly}
                  onChange={e => setForm(prev => ({ ...prev, price_monthly: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="199.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Preço Anual (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_yearly}
                  onChange={e => setForm(prev => ({ ...prev, price_yearly: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1990.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Máximo de Profissionais
              </label>
              <input
                type="number"
                min="1"
                value={form.max_professionals}
                onChange={e => setForm(prev => ({ ...prev, max_professionals: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Deixe em branco para ilimitado"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Máximo de números WhatsApp *
              </label>
              <input
                type="number"
                required
                min="1"
                value={form.max_whatsapp_numbers}
                onChange={e => setForm(prev => ({ ...prev, max_whatsapp_numbers: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1"
              />
            </div>
          </div>
        </div>

        {/* Módulos */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Módulos Inclusos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Selecione quais módulos estarão disponíveis neste plano
          </p>
          <ModuleSelector
            selectedModules={modules}
            onChange={setModules}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/admin/plans"
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading || modules.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            {loading ? 'Criando...' : 'Criar Plano'}
          </button>
        </div>
      </form>
    </div>
  )
}
