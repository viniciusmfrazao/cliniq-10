'use client'

import { useState } from 'react'
import { ToothCondition, CONDITION_COLORS, CONDITION_LABELS } from './teeth-data'

type ToothProps = {
  number: number
  x: number
  y: number
  conditions: ToothCondition[]
  selected: boolean
  onClick: () => void
}

// Dente renderizado como SVG simples
export function ToothSVG({ number, x, y, conditions, selected, onClick }: ToothProps) {
  const mainColor = conditions.length > 0
    ? CONDITION_COLORS[conditions[0]]
    : '#f8fafc'

  const stroke = selected ? '#7c3aed' : conditions.length > 0 ? '#94a3b8' : '#cbd5e1'
  const strokeWidth = selected ? 2.5 : 1.5

  // Molares (números terminando em 6,7,8) são maiores
  const isMolar = [6,7,8].includes(number % 10)
  const w = isMolar ? 28 : 22
  const h = isMolar ? 30 : 26

  return (
    <g
      transform={`translate(${x - w/2}, ${y - h/2})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Corpo do dente */}
      <rect
        width={w}
        height={h}
        rx={4}
        fill={mainColor}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      {/* Múltiplas condições — pontos */}
      {conditions.slice(1, 4).map((c, i) => (
        <circle
          key={c}
          cx={w - 5 - i * 6}
          cy={5}
          r={3}
          fill={CONDITION_COLORS[c]}
        />
      ))}

      {/* Número do dente */}
      <text
        x={w / 2}
        y={h / 2 + 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight={selected ? 700 : 500}
        fill={conditions.length > 0 ? '#fff' : '#64748b'}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {number}
      </text>
    </g>
  )
}

// Painel de condições ao clicar num dente
type ConditionPanelProps = {
  toothNumber: number
  conditions: ToothCondition[]
  notes: string
  onToggle: (c: ToothCondition) => void
  onNotes: (n: string) => void
  onClose: () => void
}

export function ToothConditionPanel({
  toothNumber,
  conditions,
  notes,
  onToggle,
  onNotes,
  onClose,
}: ConditionPanelProps) {
  const allConditions = Object.entries(CONDITION_LABELS) as [ToothCondition, string][]

  return (
    <div className="absolute z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-64"
      style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">Dente {toothNumber}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {allConditions.map(([key, label]) => {
          const active = conditions.includes(key)
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                active
                  ? 'text-white border-transparent'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              style={active ? { backgroundColor: CONDITION_COLORS[key], borderColor: CONDITION_COLORS[key] } : {}}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: active ? '#fff' : CONDITION_COLORS[key] }}
              />
              {label}
            </button>
          )
        })}
      </div>

      <textarea
        className="w-full text-xs border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
        rows={2}
        placeholder="Observação sobre este dente..."
        value={notes}
        onChange={e => onNotes(e.target.value)}
      />
    </div>
  )
}
