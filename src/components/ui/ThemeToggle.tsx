'use client'

import { useTheme } from '@/contexts/ThemeContext'
import Icon from './Icon'

export default function ThemeToggle({ variant = 'default' }: { variant?: 'default' | 'sidebar' }) {
  const { mode, toggleMode } = useTheme()

  if (variant === 'sidebar') {
    return (
      <button
        onClick={toggleMode}
        className="p-2.5 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        title={mode === 'dark' ? 'Modo claro' : 'Modo escuro'}
      >
        <Icon name={mode === 'dark' ? 'sun' : 'moon'} className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={toggleMode}
      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all"
      title={mode === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      <Icon name={mode === 'dark' ? 'sun' : 'moon'} className="w-5 h-5 text-slate-600 dark:text-slate-300" />
    </button>
  )
}
