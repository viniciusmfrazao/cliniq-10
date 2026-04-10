'use client'

import { useEffect, useState } from 'react'

const THEMES = [
  { id: 'default', name: 'Roxo', color: '#8B5CF6', gradient: 'from-violet-500 to-purple-600' },
  { id: 'pink', name: 'Rosa', color: '#EC4899', gradient: 'from-pink-500 to-rose-500' },
  { id: 'blue', name: 'Azul', color: '#3B82F6', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'green', name: 'Verde', color: '#10B981', gradient: 'from-emerald-500 to-teal-500' },
  { id: 'orange', name: 'Laranja', color: '#F97316', gradient: 'from-orange-500 to-amber-500' },
]

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState('default')

  useEffect(() => {
    const saved = localStorage.getItem('cliniq-theme') || 'default'
    setCurrentTheme(saved)
    applyTheme(saved)
  }, [])

  function applyTheme(themeId: string) {
    if (themeId === 'default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', themeId)
    }
  }

  function selectTheme(themeId: string) {
    setCurrentTheme(themeId)
    localStorage.setItem('cliniq-theme', themeId)
    applyTheme(themeId)
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Escolha a cor principal do sistema
      </p>
      <div className="grid grid-cols-5 gap-3">
        {THEMES.map(theme => (
          <button
            key={theme.id}
            onClick={() => selectTheme(theme.id)}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              currentTheme === theme.id 
                ? 'border-slate-900 bg-slate-50' 
                : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <div 
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.gradient} shadow-lg`}
              style={{ boxShadow: `0 4px 14px ${theme.color}40` }}
            />
            <span className="text-xs font-medium text-slate-700">{theme.name}</span>
            {currentTheme === theme.id && (
              <div className="absolute top-2 right-2 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
