'use client'

import { useState, useEffect } from 'react'
import { AVAILABLE_MODULES, MODULE_CATEGORIES, getDefaultModules, type ModuleId, type Module } from '@/lib/modules'

type Props = {
  selectedModules: ModuleId[]
  onChange: (modules: ModuleId[]) => void
  disabled?: boolean
}

export default function ModuleSelector({ selectedModules, onChange, disabled }: Props) {
  const [selected, setSelected] = useState<Set<ModuleId>>(new Set(selectedModules))

  useEffect(() => {
    setSelected(new Set(selectedModules))
  }, [selectedModules])

  const toggleModule = (moduleId: ModuleId) => {
    if (disabled) return
    
    const newSelected = new Set(selected)
    if (newSelected.has(moduleId)) {
      newSelected.delete(moduleId)
    } else {
      newSelected.add(moduleId)
    }
    setSelected(newSelected)
    onChange(Array.from(newSelected))
  }

  const selectAll = () => {
    if (disabled) return
    const all = AVAILABLE_MODULES.map(m => m.id)
    setSelected(new Set(all))
    onChange(all)
  }

  const selectDefaults = () => {
    if (disabled) return
    const defaults = getDefaultModules()
    setSelected(new Set(defaults))
    onChange(defaults)
  }

  const clearAll = () => {
    if (disabled) return
    setSelected(new Set())
    onChange([])
  }

  const categories = Object.entries(MODULE_CATEGORIES) as [Module['category'], typeof MODULE_CATEGORIES.core][]

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled}
          className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition disabled:opacity-50"
        >
          Selecionar todos
        </button>
        <button
          type="button"
          onClick={selectDefaults}
          disabled={disabled}
          className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
        >
          Padrão
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled}
          className="text-xs px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition disabled:opacity-50"
        >
          Limpar
        </button>
        <span className="text-xs text-slate-500 ml-auto">
          {selected.size} de {AVAILABLE_MODULES.length} módulos
        </span>
      </div>

      {/* Modules by Category */}
      {categories.map(([categoryId, category]) => {
        const modules = AVAILABLE_MODULES.filter(m => m.category === categoryId)
        
        return (
          <div key={categoryId}>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {category.name}
              <span className="text-xs font-normal text-slate-500 ml-2">
                {category.description}
              </span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {modules.map((module) => {
                const isSelected = selected.has(module.id)
                
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => toggleModule(module.id)}
                    disabled={disabled}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      isSelected 
                        ? 'bg-blue-100 dark:bg-blue-800' 
                        : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      {module.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm ${
                          isSelected 
                            ? 'text-blue-900 dark:text-blue-100' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {module.name}
                        </p>
                        {module.defaultEnabled && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${
                        isSelected 
                          ? 'text-blue-700 dark:text-blue-300' 
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {module.description}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
