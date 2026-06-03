import { Icon } from './Icon'

interface LoadingSpinnerProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  inline?: boolean
}

/**
 * Loading Spinner — spinner animado com label opcional
 */
export function LoadingSpinner({ label, size = 'md', inline = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={`flex items-center gap-2 ${inline ? '' : 'justify-center py-4'}`}>
      <div className={`${sizeClasses[size]} border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin`} />
      {label && <span className={`${textSizes[size]} text-slate-600 font-medium`}>{label}</span>}
    </div>
  )
}
