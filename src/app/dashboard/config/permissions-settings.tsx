'use client'

type Permission = {
  id: string
  role: string
  module: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

const ROLES = [
  { value: 'doctor', label: 'Medico(a)' },
  { value: 'esthetician', label: 'Esteticista' },
  { value: 'receptionist', label: 'Recepcionista' },
  { value: 'viewer', label: 'Visualizador' },
]

const MODULES = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'pacientes', label: 'Pacientes' },
  { value: 'prontuario', label: 'Prontuario' },
  { value: 'injetaveis', label: 'Injetaveis' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'crm', label: 'CRM' },
]

const DEFAULT_PERMISSIONS: Record<string, Record<string, { view: boolean; edit: boolean }>> = {
  doctor: {
    agenda: { view: true, edit: true },
    pacientes: { view: true, edit: true },
    prontuario: { view: true, edit: true },
    injetaveis: { view: true, edit: true },
    estoque: { view: true, edit: false },
    documentos: { view: true, edit: true },
    whatsapp: { view: false, edit: false },
    crm: { view: false, edit: false },
  },
  esthetician: {
    agenda: { view: true, edit: true },
    pacientes: { view: true, edit: true },
    prontuario: { view: true, edit: true },
    injetaveis: { view: true, edit: true },
    estoque: { view: true, edit: false },
    documentos: { view: true, edit: false },
    whatsapp: { view: false, edit: false },
    crm: { view: false, edit: false },
  },
  receptionist: {
    agenda: { view: true, edit: true },
    pacientes: { view: true, edit: true },
    prontuario: { view: false, edit: false },
    injetaveis: { view: false, edit: false },
    estoque: { view: false, edit: false },
    documentos: { view: true, edit: false },
    whatsapp: { view: true, edit: true },
    crm: { view: true, edit: true },
  },
  viewer: {
    agenda: { view: true, edit: false },
    pacientes: { view: true, edit: false },
    prontuario: { view: false, edit: false },
    injetaveis: { view: false, edit: false },
    estoque: { view: false, edit: false },
    documentos: { view: false, edit: false },
    whatsapp: { view: false, edit: false },
    crm: { view: false, edit: false },
  },
}

export default function PermissionsSettings({ 
  clinicId, 
  permissions 
}: { 
  clinicId: string
  permissions: Permission[] 
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Abaixo estao as permissoes padrao por funcao. O admin sempre tem acesso total.
      </p>

      {ROLES.map(role => (
        <div key={role.value} className="border border-slate-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{role.label}</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {MODULES.map(module => {
              const perm = DEFAULT_PERMISSIONS[role.value]?.[module.value]
              const hasView = perm?.view
              const hasEdit = perm?.edit
              
              return (
                <div 
                  key={module.value} 
                  className={`text-xs px-3 py-2 rounded-lg ${
                    hasEdit 
                      ? 'bg-green-50 text-green-700' 
                      : hasView 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <span className="font-medium">{module.label}</span>
                  <span className="block text-[10px] mt-0.5">
                    {hasEdit ? 'Editar' : hasView ? 'Ver' : 'Sem acesso'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-400">
        Para personalizar permissoes individuais, entre em contato com o suporte.
      </p>
    </div>
  )
}
