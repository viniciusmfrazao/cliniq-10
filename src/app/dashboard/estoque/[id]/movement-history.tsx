import Icon from '@/components/ui/Icon'

type Movement = {
  id: string
  type: string
  quantity: number
  previous_stock: number
  new_stock: number
  reason: string | null
  created_at: string
  users: { name: string } | null
  patients: { name: string } | null
}

export default function MovementHistory({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon name="list" className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">Nenhuma movimentacao registrada</p>
      </div>
    )
  }

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'entrada': return { icon: 'plus', color: 'text-emerald-600', bg: 'bg-emerald-100' }
      case 'saida': return { icon: 'minus', color: 'text-red-600', bg: 'bg-red-100' }
      case 'uso_atendimento': return { icon: 'syringe', color: 'text-purple-600', bg: 'bg-purple-100' }
      default: return { icon: 'refresh', color: 'text-blue-600', bg: 'bg-blue-100' }
    }
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {movements.map(m => {
        const config = getTypeConfig(m.type)
        return (
          <div key={m.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
            <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon name={config.icon} className={`w-4 h-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-semibold ${config.color}`}>
                  {m.type === 'entrada' && '+'}
                  {m.type === 'saida' && '-'}
                  {m.quantity} unidades
                </p>
                <span className="text-xs text-slate-400">
                  {m.previous_stock} → {m.new_stock}
                </span>
              </div>
              {m.reason && (
                <p className="text-xs text-slate-600 mt-0.5">{m.reason}</p>
              )}
              {m.patients?.name && (
                <p className="text-xs text-slate-500 mt-0.5">Paciente: {m.patients.name}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {new Date(m.created_at).toLocaleString('pt-BR')}
                {m.users?.name && ` • ${m.users.name}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
