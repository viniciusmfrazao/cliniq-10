import '@testing-library/jest-dom'

// Mock do next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock do Supabase
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

// Silenciar console.log em testes (opcional)
// global.console.log = jest.fn()
