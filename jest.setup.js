/**
 * Jest setup file
 */

import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock PostHog
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  people: {
    set: jest.fn(),
  },
  group: jest.fn(),
  getFeatureFlag: jest.fn(),
  getActiveMatchingFeatureFlags: jest.fn(() => ({})),
  flush: jest.fn(),
  debug: jest.fn(),
}))

// Mock Stripe
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({
    elements: jest.fn(() => ({
      create: jest.fn(() => ({
        mount: jest.fn(),
        unmount: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
      getElement: jest.fn(),
    })),
    confirmPayment: jest.fn(),
    confirmCardPayment: jest.fn(),
  })),
}))

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    span: 'span',
    form: 'form',
  },
  AnimatePresence: ({ children }) => children,
}))

// Mock environment variables
process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-posthog-key'
process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://app.posthog.com'
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
process.env.OPENAI_API_KEY = 'sk-test-123'

// Mock fetch
global.fetch = jest.fn()

// Mock performance
global.performance = {
  now: jest.fn(() => Date.now()),
  timeOrigin: Date.now() - 10000,
}

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})

Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value: 'Jest Test Runner',
})

Object.defineProperty(navigator, 'language', {
  writable: true,
  value: 'en-US',
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock Element.scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

// Suppress console errors in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})