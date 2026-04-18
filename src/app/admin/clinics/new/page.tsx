'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ModuleSelector from '@/components/admin/ModuleSelector'
import { getDefaultModules, type ModuleId } from '@/lib/modules'

type Plan = {
  id: string
  name: string
  description: string | null
  price_monthly: number
  modules: ModuleId[]
  max_professionals: number | null
}

export default function NewClinicPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [activeModules, setActiveModules] = useState<ModuleId[]>(getDefaultModules())
  
  const [form, setForm] = useState({
    name: '',
    cnpj: '',
    slug: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  })

  // Carregar planos disponíveis
  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await fetch('/api/admin/plans')
        if (res.ok) {
          const data = await res.json()
          setPlans(data.filter((p: Plan) => p))
        }
      } catch (e) {
        console.error('Erro ao carregar planos:', e)
      }
    }
    loadPlans()
  }, [])

  // Auto-preencher módulos ao selecionar plano
  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId)
    if (planId) {
      const plan = plans.find(p => p.id === planId)
      if (plan?.modules) {
        setActiveModules(plan.modules as ModuleId[])
      }
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const selectedPlan = plans.find(p => p.id === selectedPlanId)
      const res = await fetch('/api/admin/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...form, 
          activeModules,
          planId: selectedPlanId || null,
          planName: selectedPlan?.name || 'custom'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar clínica')
      }

      router.push(`/admin/clinics/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar clínica')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/clinics"
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Voltar
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nova Clínica</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Cadastre uma nova clínica no sistema
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
        {/* Dados da Clínica */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Dados da Clínica
          </h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome da Clínica *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Clínica Estética Beauty"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Slug (URL)
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="clinica-beauty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={e => setForm(prev => ({ ...prev, cnpj: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Plano
              </label>
              <select
                value={selectedPlanId}
                onChange={e => handlePlanChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um plano (ou configure manualmente)</option>
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - R$ {plan.price_monthly}/mês
                    {plan.max_professionals && ` (até ${plan.max_professionals} profissionais)`}
                  </option>
                ))}
              </select>
              {plans.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  <Link href="/admin/plans/new" className="text-blue-600 hover:underline">
                    Crie planos primeiro
                  </Link> ou configure os módulos manualmente abaixo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Módulos */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Módulos Disponíveis
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Selecione quais módulos essa clínica terá acesso
          </p>
          <ModuleSelector
            selectedModules={activeModules}
            onChange={setActiveModules}
          />
        </div>

        {/* Dados do Admin */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Administrador da Clínica
          </h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome do Admin *
              </label>
              <input
                type="text"
                required
                value={form.adminName}
                onChange={e => setForm(prev => ({ ...prev, adminName: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome completo"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={form.adminEmail}
                onChange={e => setForm(prev => ({ ...prev, adminEmail: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@clinica.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Senha *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={form.adminPassword}
                onChange={e => setForm(prev => ({ ...prev, adminPassword: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Link
            href="/admin/clinics"
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            {loading ? 'Criando...' : 'Criar Clínica'}
          </button>
        </div>
      </form>
    </div>
  )
}
