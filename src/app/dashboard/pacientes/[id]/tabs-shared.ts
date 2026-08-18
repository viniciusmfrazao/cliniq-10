export type PatientTab =
  | 'overview'
  | 'evolucoes'
  | 'consultas'
  | 'anamneses'
  | 'injetaveis'
  | 'pacotes'
  | 'financeiro'
  | 'documentos'
  | 'anexos'
  | 'odontograma'

export const TABS: Array<{ id: PatientTab; label: string; icon: string; module?: string }> = [
  { id: 'overview', label: 'Visão geral', icon: 'user' },
  { id: 'evolucoes', label: 'Evoluções', icon: 'file' },
  { id: 'consultas', label: 'Atendimentos', icon: 'calendar' },
  { id: 'anamneses', label: 'Anamneses', icon: 'clipboard' },
  { id: 'injetaveis', label: 'Injetáveis', icon: 'syringe' },
  { id: 'pacotes', label: 'Pacotes', icon: 'package' },
  { id: 'financeiro', label: 'Financeiro', icon: 'dollarSign' },
  { id: 'documentos', label: 'Documentos', icon: 'file' },
  { id: 'anexos', label: 'Anexos', icon: 'paperclip' },
]

export function isValidTab(tab: string | undefined): tab is PatientTab {
  return !!tab && TABS.some((t) => t.id === tab)
}

export function getVisibleTabs(enabledModules: string[] = []) {
  return TABS.filter((t) => !t.module || enabledModules.includes(t.module))
}
