'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

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

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem('theme-mode')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return 'light'
}

function getInitialColor(): ThemeColor {
  if (typeof window === 'undefined') return 'default'
  try {
    const saved = localStorage.getItem('theme-color') || localStorage.getItem('clinike-theme')
    if (saved && saved !== 'default') return saved as ThemeColor
  } catch {}
  return 'default'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [color, setColorState] = useState<ThemeColor>('default')
  const [mounted, setMounted] = useState(false)

  // Apply theme safely after mount
  useEffect(() => {
    const initialMode = getInitialMode()
    const initialColor = getInitialColor()
    
    setModeState(initialMode)
    setColorState(initialColor)
    
    // Apply to DOM
    if (initialMode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    if (initialColor !== 'default') {
      document.documentElement.setAttribute('data-theme', initialColor)
    }
    
    setMounted(true)
  }, [])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    try {
      localStorage.setItem('theme-mode', newMode)
    } catch {}
    
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const setColor = useCallback((newColor: ThemeColor) => {
    setColorState(newColor)
    try {
      localStorage.setItem('theme-color', newColor)
    } catch {}
    
    if (newColor === 'default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', newColor)
    }
  }, [])

  const toggleMode = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : 'light')
  }, [mode, setMode])

  // Don't render children until mounted to avoid hydration mismatch
  if (!mounted) {
    return null
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
