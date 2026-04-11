'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { useTheme } from '@/contexts/ThemeContext'

const THEMES = [
  { 
    id: 'default', 
    name: 'Violeta', 
    description: 'Elegante e moderno',
    gradient: 'from-violet-500 to-pink-500',
    colors: ['#8B5CF6', '#EC4899']
  },
  { 
    id: 'rose', 
    name: 'Rose', 
    description: 'Vibrante e feminino',
    gradient: 'from-rose-500 to-pink-500',
    colors: ['#F43F5E', '#EC4899']
  },
  { 
    id: 'ocean', 
    name: 'Oceano', 
    description: 'Calmo e profissional',
    gradient: 'from-sky-500 to-cyan-500',
    colors: ['#0EA5E9', '#06B6D4']
  },
  { 
    id: 'emerald', 
    name: 'Esmeralda', 
    description: 'Natural e fresh',
    gradient: 'from-emerald-500 to-teal-500',
    colors: ['#10B981', '#14B8A6']
  },
  { 
    id: 'sunset', 
    name: 'Por do Sol', 
    description: 'Quente e energico',
    gradient: 'from-orange-500 to-yellow-500',
    colors: ['#F97316', '#EAB308']
  },
  { 
    id: 'lavender', 
    name: 'Lavanda', 
    description: 'Suave e relaxante',
    gradient: 'from-purple-500 to-fuchsia-500',
    colors: ['#A855F7', '#D946EF']
  },
]

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState('default')
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null)
  const { mode, setMode } = useTheme()

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

  const activeTheme = THEMES.find(t => t.id === (hoveredTheme || currentTheme)) || THEMES[0]

  return (
    <div>
      {/* Modo Claro/Escuro */}
      <div className="mb-8">
        <p className="text-sm font-medium text-slate-700 mb-3">Modo de exibição</p>
        <div className="flex gap-3">
          <button
            onClick={() => setMode('light')}
            className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              mode === 'light' 
                ? 'border-slate-900 bg-white shadow-md' 
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              mode === 'light' ? 'bg-amber-100' : 'bg-slate-200'
            }`}>
              <Icon name="sun" className={`w-5 h-5 ${mode === 'light' ? 'text-amber-600' : 'text-slate-500'}`} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900 text-sm">Claro</p>
              <p className="text-xs text-slate-500">Fundo branco</p>
            </div>
            {mode === 'light' && (
              <Icon name="check" className="w-5 h-5 text-slate-900 ml-auto" />
            )}
          </button>
          
          <button
            onClick={() => setMode('dark')}
            className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              mode === 'dark' 
                ? 'border-slate-900 bg-slate-800 shadow-md' 
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              mode === 'dark' ? 'bg-indigo-900' : 'bg-slate-200'
            }`}>
              <Icon name="moon" className={`w-5 h-5 ${mode === 'dark' ? 'text-indigo-300' : 'text-slate-500'}`} />
            </div>
            <div className="text-left">
              <p className={`font-semibold text-sm ${mode === 'dark' ? 'text-white' : 'text-slate-900'}`}>Escuro</p>
              <p className={`text-xs ${mode === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Fundo escuro</p>
            </div>
            {mode === 'dark' && (
              <Icon name="check" className="w-5 h-5 text-white ml-auto" />
            )}
          </button>
        </div>
      </div>

      {/* Cores */}
      <p className="text-sm font-medium text-slate-700 mb-3">Cor do tema</p>
      <p className="text-sm text-slate-500 mb-4">
        Personalize a aparência do sistema com sua cor favorita
      </p>

      {/* Preview */}
      <div 
        className={`mb-6 p-6 rounded-3xl bg-gradient-to-br ${activeTheme.gradient} text-white relative overflow-hidden transition-all duration-500`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Icon name="palette" className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg">{activeTheme.name}</p>
              <p className="text-white/70 text-sm">{activeTheme.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {activeTheme.colors.map((color, i) => (
              <div 
                key={i}
                className="w-8 h-8 rounded-lg shadow-lg"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {THEMES.map(theme => (
          <button
            key={theme.id}
            onClick={() => selectTheme(theme.id)}
            onMouseEnter={() => setHoveredTheme(theme.id)}
            onMouseLeave={() => setHoveredTheme(null)}
            className={`relative p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
              currentTheme === theme.id 
                ? 'border-slate-900 shadow-lg scale-[1.02]' 
                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
          >
            <div 
              className={`w-full h-16 rounded-xl bg-gradient-to-r ${theme.gradient} mb-3 transition-transform duration-300 ${
                currentTheme === theme.id ? 'scale-[1.02]' : ''
              }`}
            />
            <p className="font-semibold text-slate-900 text-sm">{theme.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{theme.description}</p>
            
            {currentTheme === theme.id && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center">
                <Icon name="check" className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
