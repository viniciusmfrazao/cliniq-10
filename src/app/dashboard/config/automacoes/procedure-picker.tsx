'use client'

import { useMemo, useState } from 'react'
import Icon from '@/components/ui/Icon'

export interface ProcedureOption {
  id: string
  name: string
  is_consulta?: boolean | null
  active?: boolean | null
}

/**
 * Seletor de procedimentos reutilizado pelo recall e pelo pós-atendimento.
 *
 * Propositalmente "burro": não sabe o que a seleção significa (whitelist,
 * blacklist, etapa específica). Quem chama decide. Isso evita que a regra de
 * negócio se espalhe por duas telas diferentes.
 */
export default function ProcedurePicker({
  procedures,
  selected,
  onChange,
  emptyHint = 'Nenhum procedimento cadastrado.',
}: {
  procedures: ProcedureOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyHint?: string
}) {
  const [search, setSearch] = useState('')

  // Procedimento inativo continua listado se já estiver selecionado — senão a
  // clínica desativa um procedimento e a seleção some da tela sem explicação,
  // mesmo continuando gravada no banco.
  const visiveis = useMemo(() => {
    const sel = new Set(selected)
    const base = procedures.filter((p) => p.active !== false || sel.has(p.id))
    const q = search.trim().toLowerCase()
    return q ? base.filter((p) => p.name.toLowerCase().includes(q)) : base
  }, [procedures, selected, search])

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selected, id] : selected.filter((x) => x !== id))
  }

  if (procedures.length === 0) {
    return <p className="text-xs text-slate-500">{emptyHint}</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {procedures.length > 8 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar procedimento..."
            className="input flex-1 text-sm py-1.5"
          />
        )}
        <button
          type="button"
          onClick={() => onChange(visiveis.map((p) => p.id))}
          className="text-xs text-violet-600 hover:text-violet-800 font-medium whitespace-nowrap"
        >
          Marcar todos
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-slate-500 hover:text-slate-700 whitespace-nowrap"
        >
          Limpar
        </button>
      </div>

      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
        {visiveis.length === 0 ? (
          <p className="text-xs text-slate-400 p-3">Nenhum procedimento encontrado.</p>
        ) : (
          visiveis.map((proc) => {
            const checked = selected.includes(proc.id)
            return (
              <label
                key={proc.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggle(proc.id, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30"
                />
                <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">
                  {proc.name}
                </span>
                {proc.active === false && (
                  <span className="badge badge-slate text-[10px] flex-shrink-0">inativo</span>
                )}
              </label>
            )
          })
        )}
      </div>

      <p className="text-xs text-slate-500 flex items-center gap-1">
        <Icon name="check" className="w-3 h-3" />
        {selected.length === 0
          ? 'Nenhum procedimento selecionado'
          : `${selected.length} procedimento${selected.length > 1 ? 's' : ''} selecionado${selected.length > 1 ? 's' : ''}`}
      </p>
    </div>
  )
}
