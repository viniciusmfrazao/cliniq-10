import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export type PatientTab =
  | 'overview'
  | 'evolucoes'
  | 'consultas'
  | 'anamneses'
  | 'injetaveis'
  | 'pacotes'
  | 'odontograma'

const TABS: Array<{ id: PatientTab; label: string; icon: string; module?: string }> = [
  { id: 'overview', label: 'Visão geral', icon: 'user' },
  { id: 'evolucoes', label: 'Evoluções', icon: 'file' },
  { id: 'consultas', label: 'Atendimentos', icon: 'calendar' },
  { id: 'anamneses', label: 'Anamneses', icon: 'clipboard' },
  { id: 'injetaveis', label: 'Injetáveis', icon: 'syringe' },
  { id: 'pacotes', label: 'Pacotes', icon: 'package' },
]

export function isValidTab(tab: string | undefined): tab is PatientTab {
  return !!tab && TABS.some((t) => t.id === tab)
}

/**
 * Tabs server-side. Cada tab é um <Link> que troca o ?tab=... — simples,
 * deep-linkável e prefetchable. Não usa estado client por design.
 */
export function getVisibleTabs(enabledModules: string[] = []) {
  return ALL_TABS.filter(t => !t.module || enabledModules.includes(t.module))
}

export default function PatientTabs({
  patientId,
  current,
  counts,
}: {
  patientId: string
  current: PatientTab
  /** Contagem opcional pra mostrar badge nas tabs (ex: 3 anamneses) */
  counts?: Partial<Record<PatientTab, number>>
}) {
  return (
    <div className="border-b border-slate-200 mb-6 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {TABS.map((tab) => {
          const active = tab.id === current
          const href =
            tab.id === 'overview'
              ? `/dashboard/pacientes/${patientId}`
              : `/dashboard/pacientes/${patientId}?tab=${tab.id}`
          const count = counts?.[tab.id]
          return (
            <Link
              key={tab.id}
              href={href}
              prefetch
              scroll={false}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`ml-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
