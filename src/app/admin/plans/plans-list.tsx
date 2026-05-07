'use client'

import Link from 'next/link'
import { AVAILABLE_MODULES } from '@/lib/modules'

type Plan = {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_yearly: number | null
  modules: string[]
  max_professionals: number | null
  max_whatsapp_numbers?: number | null
  active: boolean
}

export default function PlansList({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          Nenhum plano cadastrado ainda
        </p>
        <Link
          href="/admin/plans/new"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Criar primeiro plano →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan) => {
        const moduleNames = plan.modules
          .map(id => AVAILABLE_MODULES.find(m => m.id === id)?.name)
          .filter(Boolean)

        return (
          <div
            key={plan.id}
            className={`bg-white dark:bg-slate-800 rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
              plan.active 
                ? 'border-slate-200 dark:border-slate-700' 
                : 'border-red-200 dark:border-red-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {plan.description}
                  </p>
                )}
              </div>
              {!plan.active && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                  Inativo
                </span>
              )}
            </div>

            <div className="mb-4">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                R$ {plan.price_monthly.toLocaleString('pt-BR')}
                <span className="text-sm font-normal text-slate-500">/mês</span>
              </p>
              {plan.price_yearly && (
                <p className="text-sm text-slate-500">
                  ou R$ {plan.price_yearly.toLocaleString('pt-BR')}/ano
                </p>
              )}
            </div>

            {plan.max_professionals && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                👥 Até {plan.max_professionals} profissionais
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              📱 Até {plan.max_whatsapp_numbers || 1} número{(plan.max_whatsapp_numbers || 1) > 1 ? 's' : ''} de WhatsApp
            </p>

            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                {plan.modules.length} módulos inclusos
              </p>
              <div className="flex flex-wrap gap-1">
                {moduleNames.slice(0, 5).map((name, i) => (
                  <span
                    key={i}
                    className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded"
                  >
                    {name}
                  </span>
                ))}
                {moduleNames.length > 5 && (
                  <span className="text-xs text-slate-500">
                    +{moduleNames.length - 5} mais
                  </span>
                )}
              </div>
            </div>

            <Link
              href={`/admin/plans/${plan.id}`}
              className="block w-full text-center py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm font-medium"
            >
              Editar plano
            </Link>
          </div>
        )
      })}
    </div>
  )
}
