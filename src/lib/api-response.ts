import { NextResponse } from 'next/server'
import { createLogger } from './logger'

const log = createLogger('API')

export type ApiError = {
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: ApiError
}

// Códigos de erro padronizados
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

// Mensagens de erro amigáveis
const ErrorMessages: Record<string, string> = {
  UNAUTHORIZED: 'Você precisa estar logado para acessar este recurso',
  FORBIDDEN: 'Você não tem permissão para acessar este recurso',
  NOT_FOUND: 'Recurso não encontrado',
  VALIDATION_ERROR: 'Dados inválidos',
  DATABASE_ERROR: 'Erro ao acessar o banco de dados',
  INTERNAL_ERROR: 'Erro interno do servidor',
  RATE_LIMITED: 'Muitas requisições. Tente novamente em alguns minutos',
}

// Resposta de sucesso
export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

// Resposta de erro
export function error(
  code: keyof typeof ErrorCodes,
  details?: unknown,
  customMessage?: string
): NextResponse<ApiResponse> {
  const statusMap: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    DATABASE_ERROR: 500,
    INTERNAL_ERROR: 500,
    RATE_LIMITED: 429,
  }

  const message = customMessage || ErrorMessages[code] || 'Erro desconhecido'
  
  log.error(`API Error: ${code}`, undefined, { code, message, details })

  return NextResponse.json(
    { 
      success: false, 
      error: { code, message, details } 
    },
    { status: statusMap[code] || 500 }
  )
}

// Wrapper para handlers de API com tratamento de erro automático
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T>>> {
  return handler().catch((err: Error) => {
    log.error('Unhandled API error', err)
    
    // Verificar tipos específicos de erro
    if (err.message.includes('JWT')) {
      return error('UNAUTHORIZED')
    }
    
    if (err.message.includes('permission') || err.message.includes('RLS')) {
      return error('FORBIDDEN')
    }
    
    if (err.message.includes('not found') || err.message.includes('no rows')) {
      return error('NOT_FOUND')
    }

    return error('INTERNAL_ERROR', process.env.NODE_ENV === 'development' ? err.message : undefined)
  }) as Promise<NextResponse<ApiResponse<T>>>
}
