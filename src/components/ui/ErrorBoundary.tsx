'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { createLogger } from '@/lib/logger'

const log = createLogger('ErrorBoundary')

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    log.error('React component error', error, {
      componentStack: errorInfo.componentStack,
    })

    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Ops! Algo deu errado
            </h2>
            
            <p className="text-slate-600 mb-6">
              Ocorreu um erro inesperado. Nossa equipe foi notificada.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 rounded-xl text-left">
                <p className="text-sm font-mono text-red-700 break-all">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-32">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-6 py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-xl font-semibold transition-colors"
              >
                Voltar ao início
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook para usar em componentes funcionais
export function useErrorHandler() {
  return (error: Error, context?: Record<string, unknown>) => {
    log.error('Component error', error, context)
  }
}

export default ErrorBoundary
