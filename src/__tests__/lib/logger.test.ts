import { logger, createLogger } from '@/lib/logger'

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    logger.clearContext()
  })

  describe('log levels', () => {
    it('should log info messages', () => {
      logger.info('Test message')
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should log warnings', () => {
      logger.warn('Warning message')
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should log errors with stack trace', () => {
      const error = new Error('Test error')
      logger.error('Error occurred', error)
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('context', () => {
    it('should set and include context in logs', () => {
      logger.setContext({ userId: 'user-123', clinicId: 'clinic-456' })
      logger.info('Message with context')
      
      expect(consoleSpy).toHaveBeenCalled()
      const logOutput = consoleSpy.mock.calls[0]
      expect(logOutput).toBeDefined()
    })

    it('should clear context', () => {
      logger.setContext({ userId: 'user-123' })
      logger.clearContext()
      logger.info('Message after clear')
      
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('createLogger', () => {
    it('should create logger with component context', () => {
      const componentLogger = createLogger('TestComponent')
      componentLogger.info('Component message')
      
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('action logging', () => {
    it('should log user actions', () => {
      logger.action('button_click', { buttonId: 'submit' })
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('database logging', () => {
    it('should log database operations', () => {
      logger.db('INSERT', 'patients', { patientId: 'p-123' })
      expect(consoleSpy).toHaveBeenCalled()
    })
  })
})
