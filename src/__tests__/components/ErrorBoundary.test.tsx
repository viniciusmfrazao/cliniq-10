import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// Componente que sempre lança erro
function BrokenComponent(): never {
  throw new Error('Test error')
}

// Componente normal
function GoodComponent() {
  return <div>Everything is fine</div>
}

describe('ErrorBoundary', () => {
  // Silenciar erros do React durante os testes
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })
  afterAll(() => {
    console.error = originalError
  })

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Everything is fine')).toBeInTheDocument()
  })

  it('should render error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument()
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
    expect(screen.getByText('Voltar ao início')).toBeInTheDocument()
  })

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error message</div>}>
        <BrokenComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn()
    
    render(
      <ErrorBoundary onError={onError}>
        <BrokenComponent />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('should recover when retry button is clicked', () => {
    let shouldError = true
    
    function ConditionalError() {
      if (shouldError) {
        throw new Error('Conditional error')
      }
      return <div>Recovered!</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument()
    
    // Simular correção do erro
    shouldError = false
    
    // Clicar em tentar novamente
    fireEvent.click(screen.getByText('Tentar novamente'))
    
    // Re-renderizar
    rerender(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Recovered!')).toBeInTheDocument()
  })
})
