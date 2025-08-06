/**
 * @fileoverview Tests for AI chat API endpoint
 */

import { POST, GET } from '../../app/api/ai-sales/chat/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('../../lib/ai-sales/rate-limiter', () => ({
  checkRateLimit: jest.fn(() => null), // No rate limiting
}))

jest.mock('../../lib/ai-sales/chat-engine', () => ({
  initializeConversation: jest.fn(() => ({
    sessionId: 'test-session',
    visitorId: 'test-visitor',
    businessContext: { id: 'test-business' },
  })),
  processMessage: jest.fn(),
  generateInitialGreeting: jest.fn(() => 'Hello! How can I help you today?'),
}))

describe('/api/ai-sales/chat', () => {
  const mockBusinessContext = {
    id: 'test-business',
    name: 'Test Business',
    products: [
      {
        id: 'starter',
        name: 'Starter Plan',
        price: 99,
      },
    ],
    pricingRules: {
      basePrice: 99,
      minPrice: 49,
      maxDiscount: 30,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('should return error for missing required fields', async () => {
      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('should handle initial greeting request', async () => {
      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'test-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.response).toBe('Hello! How can I help you today?')
      expect(data.context).toBeDefined()
    })

    it('should create streaming response for chat messages', async () => {
      const mockProcessMessage = require('../../lib/ai-sales/chat-engine').processMessage
      mockProcessMessage.mockImplementation(({ onStream }) => {
        // Simulate streaming response
        onStream({ type: 'content', content: 'Hello' })
        onStream({ type: 'content', content: ' there!' })
        return Promise.resolve()
      })

      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'test-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(response.headers.get('cache-control')).toBe('no-cache')
    })

    it('should handle rate limiting', async () => {
      const mockCheckRateLimit = require('../../lib/ai-sales/rate-limiter').checkRateLimit
      mockCheckRateLimit.mockReturnValue({
        error: 'Rate limited',
        retryAfter: 60,
      })

      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'test-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(429)
      expect(response.headers.get('retry-after')).toBe('60')
    })

    it('should return 404 for non-existent business', async () => {
      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'non-existent-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(404)
    })

    it('should handle processing errors gracefully', async () => {
      const mockProcessMessage = require('../../lib/ai-sales/chat-engine').processMessage
      mockProcessMessage.mockRejectedValue(new Error('Processing failed'))

      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'test-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    it('should include default signals when none provided', async () => {
      const mockInitializeConversation = require('../../lib/ai-sales/chat-engine').initializeConversation

      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'test-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      await POST(request)

      expect(mockInitializeConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          signals: expect.objectContaining({
            mouseVelocity: 0,
            scrollDepth: expect.any(Number),
            timeOnPage: expect.any(Number),
          }),
        })
      )
    })
  })

  describe('GET', () => {
    it('should return conversation status', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai-sales/chat?sessionId=test-session'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sessionId).toBe('test-session')
      expect(data.hasActiveConversation).toBeDefined()
    })

    it('should return error for missing sessionId', async () => {
      const request = new NextRequest('http://localhost/api/ai-sales/chat')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing sessionId')
    })
  })

  describe('Business Context', () => {
    it('should load business context correctly', async () => {
      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'demo-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.context).toBeDefined()
    })

    it('should include product information in context', async () => {
      const mockInitializeConversation = require('../../lib/ai-sales/chat-engine').initializeConversation

      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'test-business',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      await POST(request)

      expect(mockInitializeConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          businessContext: expect.objectContaining({
            products: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                price: expect.any(Number),
              }),
            ]),
          }),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    it('should handle missing content-type header', async () => {
      const request = new NextRequest('http://localhost/api/ai-sales/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          visitorId: 'test-visitor',
          businessId: 'test-business',
        }),
      })

      const response = await POST(request)

      // Should still work with default content type handling
      expect(response.status).toBeLessThan(500)
    })
  })
})