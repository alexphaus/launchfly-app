/**
 * Tests for Stripe checkout API endpoint
 */

import { NextRequest } from 'next/server'
import { POST } from '../../src/app/api/stripe/checkout/route'

// Mock Stripe
const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn()
    }
  }
}

jest.mock('stripe', () => {
  return jest.fn(() => mockStripe)
})

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [{ id: 'test-order-id' }], error: null }))
    }))
  }))
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

describe('/api/stripe/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_WEBSITE_BASE_URL = 'http://localhost:3000'
  })

  const createRequest = (body) => {
    return new NextRequest('http://localhost:3000/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  }

  describe('Valid requests', () => {
    test('should create Stripe checkout session for product', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.99,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      })

      const request = createRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_session_id')
      expect(data.sessionId).toBe('cs_test_session_id')

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Product',
              description: 'A test product'
            },
            unit_amount: 9999 // $99.99 in cents
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `http://localhost:3000/sites/test-store/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:3000/sites/test-store/product/prod-001`,
        customer_email: 'test@example.com',
        metadata: {
          productId: 'prod-001',
          businessId: 'biz-001',
          customerName: 'Test Customer',
          subdomain: 'test-store'
        }
      })
    })

    test('should handle service products correctly', async () => {
      const requestBody = {
        productId: 'svc-001',
        productName: 'Consulting Service',
        productPrice: 297,
        productDescription: 'Business consulting service',
        businessId: 'biz-001',
        subdomain: 'test-consulting',
        customerEmail: 'client@example.com',
        customerName: 'Business Owner'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_service_session_id',
        url: 'https://checkout.stripe.com/pay/cs_service_session_id'
      })

      const request = createRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Consulting Service',
                description: 'Business consulting service'
              },
              unit_amount: 29700 // $297 in cents
            },
            quantity: 1
          }]
        })
      )
    })

    test('should create order record in database', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.99,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      })

      const request = createRequest(requestBody)
      await POST(request)

      expect(mockSupabase.from).toHaveBeenCalledWith('orders')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        business_id: 'biz-001',
        stripe_session_id: 'cs_test_session_id',
        product_data: {
          id: 'prod-001',
          name: 'Test Product',
          price: 99.99,
          description: 'A test product'
        },
        customer_email: 'test@example.com',
        customer_name: 'Test Customer',
        amount: 9999,
        status: 'pending'
      })
    })
  })

  describe('Error handling', () => {
    test('should return 400 for missing required fields', async () => {
      const requestBody = {
        productName: 'Test Product'
        // Missing other required fields
      }

      const request = createRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    test('should return 400 for invalid price', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 'invalid',
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      const request = createRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid price')
    })

    test('should return 400 for invalid email', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.99,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'invalid-email',
        customerName: 'Test Customer'
      }

      const request = createRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid email')
    })

    test('should handle Stripe API errors', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.99,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockRejectedValueOnce(
        new Error('Stripe API error')
      )

      const request = createRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to create checkout session')
    })

    test('should handle database errors', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.99,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      })

      mockSupabase.from().insert().select.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      })

      const request = createRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to create order record')
    })
  })

  describe('Price formatting', () => {
    test('should handle decimal prices correctly', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.95,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      })

      const request = createRequest(requestBody)
      await POST(request)

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 9995 // $99.95 in cents
            }),
            quantity: 1
          }]
        })
      )
    })

    test('should handle whole number prices', async () => {
      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 100,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      })

      const request = createRequest(requestBody)
      await POST(request)

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 10000 // $100 in cents
            }),
            quantity: 1
          }]
        })
      )
    })
  })

  describe('URL generation', () => {
    test('should use custom base URL when provided', async () => {
      process.env.NEXT_PUBLIC_WEBSITE_BASE_URL = 'https://myapp.com'

      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.99,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      })

      const request = createRequest(requestBody)
      await POST(request)

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://myapp.com/sites/test-store/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://myapp.com/sites/test-store/product/prod-001'
        })
      )
    })

    test('should fallback to localhost when no base URL', async () => {
      delete process.env.NEXT_PUBLIC_WEBSITE_BASE_URL

      const requestBody = {
        productId: 'prod-001',
        productName: 'Test Product',
        productPrice: 99.99,
        productDescription: 'A test product',
        businessId: 'biz-001',
        subdomain: 'test-store',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer'
      }

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      })

      const request = createRequest(requestBody)
      await POST(request)

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://localhost:3000/sites/test-store/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'http://localhost:3000/sites/test-store/product/prod-001'
        })
      )
    })
  })
})
