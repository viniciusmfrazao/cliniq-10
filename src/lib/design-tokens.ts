/**
 * Design Tokens - Tier 1 Premium Design System
 * Centralized color, spacing, and animation tokens
 */

export const colors = {
  // Backgrounds
  bg: {
    primary: '#fafaf8', // Warm white
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
  },

  // Text
  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    tertiary: '#94a3b8',
  },

  // Borders
  border: {
    light: '#e2e8f0',
    medium: '#cbd5e1',
    dark: '#94a3b8',
  },

  // Status - Pastels softes
  status: {
    success: {
      bg: '#dcfce7', // Pastel green
      text: '#166534',
      accent: '#22c55e',
    },
    warning: {
      bg: '#fef3c7', // Pastel amber
      text: '#92400e',
      accent: '#eab308',
    },
    error: {
      bg: '#fee2e2', // Pastel red
      text: '#7f1d1d',
      accent: '#ef4444',
    },
    info: {
      bg: '#ede9fe', // Pastel violet (primary)
      text: '#5b21b6',
      accent: '#7c3aed',
    },
  },

  // Primary gradient
  primary: {
    from: '#a78bfa',
    to: '#7c3aed',
  },
}

export const shadows = {
  sm: '0 2px 4px rgba(0, 0, 0, 0.04)',
  base: '0 4px 8px rgba(0, 0, 0, 0.06)',
  md: '0 8px 16px rgba(0, 0, 0, 0.08)',
  lg: '0 12px 24px rgba(0, 0, 0, 0.08)',
  xl: '0 16px 32px rgba(0, 0, 0, 0.1)',
}

export const transitions = {
  fast: 'all 0.15s ease-in-out',
  base: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
}
