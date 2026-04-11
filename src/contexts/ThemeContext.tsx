'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'
type ThemeColor = 'default' | 'rose' | 'ocean' | 'emerald' | 'sunset' | 'lavender'

interface ThemeContextType {
  mode: ThemeMode
  color: ThemeColor
  setMode: (mode: ThemeMode) => void
  setColor: (color: ThemeColor) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [color, setColorState] = useState<ThemeColor>('default')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null
    const savedColor = localStorage.getItem('theme-color') as ThemeColor | null
    
    if (savedMode) {
      setModeState(savedMode)
      document.documentElement.classList.toggle('dark', savedMode === 'dark')
    }
    
    if (savedColor && savedColor !== 'default') {
      setColorState(savedColor)
      document.documentElement.setAttribute('data-theme', savedColor)
    }
  }, [])

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem('theme-mode', newMode)
    document.documentElement.classList.toggle('dark', newMode === 'dark')
  }

  const setColor = (newColor: ThemeColor) => {
    setColorState(newColor)
    localStorage.setItem('theme-color', newColor)
    if (newColor === 'default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', newColor)
    }
  }

  const toggleMode = () => {
    setMode(mode === 'light' ? 'dark' : 'light')
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ mode, color, setMode, setColor, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    // Return safe defaults when used outside provider (SSR)
    return {
      mode: 'light' as ThemeMode,
      color: 'default' as ThemeColor,
      setMode: () => {},
      setColor: () => {},
      toggleMode: () => {},
    }
  }
  return context
}
