type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = {
  userId?: string
  clinicId?: string
  action?: string
  component?: string
  [key: string]: unknown
}

type LogEntry = {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const LOG_COLORS = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m'
}

class Logger {
  private context: LogContext = {}
  private isDev = process.env.NODE_ENV === 'development'

  setContext(ctx: LogContext) {
    this.context = { ...this.context, ...ctx }
  }

  clearContext() {
    this.context = {}
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }
  }

  private output(entry: LogEntry) {
    const { level, message, context, error, timestamp } = entry
    
    if (this.isDev) {
      const color = LOG_COLORS[level]
      const reset = LOG_COLORS.reset
      const time = new Date(timestamp).toLocaleTimeString('pt-BR')
      
      console.log(`${color}[${level.toUpperCase()}]${reset} ${time} - ${message}`)
      
      if (context && Object.keys(context).length > 0) {
        console.log('  Context:', context)
      }
      
      if (error) {
        console.log(`  Error: ${error.name}: ${error.message}`)
        if (error.stack) {
          console.log('  Stack:', error.stack.split('\n').slice(0, 5).join('\n'))
        }
      }
    } else {
      // Em produção, log como JSON para facilitar parsing
      console.log(JSON.stringify(entry))
    }

    // Aqui você pode adicionar integrações:
    // - Sentry, LogRocket, Datadog, etc.
    // this.sendToExternalService(entry)
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      this.output(this.formatEntry('debug', message, context))
    }
  }

  info(message: string, context?: LogContext) {
    this.output(this.formatEntry('info', message, context))
  }

  warn(message: string, context?: LogContext) {
    this.output(this.formatEntry('warn', message, context))
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const err = error instanceof Error ? error : new Error(String(error))
    this.output(this.formatEntry('error', message, context, err))
  }

  // Método auxiliar para ações do usuário
  action(actionName: string, details?: LogContext) {
    this.info(`Action: ${actionName}`, { action: actionName, ...details })
  }

  // Método auxiliar para operações de banco
  db(operation: string, table: string, details?: LogContext) {
    this.debug(`DB ${operation} on ${table}`, { 
      dbOperation: operation, 
      table, 
      ...details 
    })
  }
}

// Instância singleton
export const logger = new Logger()

// Helper para criar logger com contexto específico
export function createLogger(component: string) {
  return {
    debug: (msg: string, ctx?: LogContext) => logger.debug(msg, { component, ...ctx }),
    info: (msg: string, ctx?: LogContext) => logger.info(msg, { component, ...ctx }),
    warn: (msg: string, ctx?: LogContext) => logger.warn(msg, { component, ...ctx }),
    error: (msg: string, err?: Error | unknown, ctx?: LogContext) => logger.error(msg, err, { component, ...ctx }),
    action: (action: string, ctx?: LogContext) => logger.action(action, { component, ...ctx }),
    db: (op: string, table: string, ctx?: LogContext) => logger.db(op, table, { component, ...ctx }),
  }
}

export default logger
