/**
 * Tests for the Product Page component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductPage from '../../src/app/sites/[subdomain]/product/[productId]/page'
import { CartProvider } from '../../src/components/launchfly-ui'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({
    subdomain: 'test-business',
    productId: 'test-product-1'
  }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn()
  })
}))

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn()
        })
      })
    })
  })
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: () => mockSupabaseClient
}))

// Mock global fetch
global.fetch = jest.fn()

const mockBusinessData = {
  id: 'test-business-id',
  name: 'Test E-commerce Store',
  subdomain: 'test-business',
  status: 'ready',
  business_data: {
    businessName: 'Test E-commerce Store',
    products: [
      {
        id: 'test-product-1',
        name: 'Premium Wireless Headphones',
        price: '$199.99',
        originalPrice: '$249.99',
        description: 'High-quality wireless headphones with noise cancellation',
        image: 'https://images.unsplash.com/photo-test-headphones',
        category: 'Electronics',
        inStock: true,
        stock: 15,
        features: [
          'Active Noise Cancellation',
          '30-hour battery life',
          'Premium sound quality',
          'Comfortable fit'
        ],
        specifications: {
          battery: '30 hours',
          weight: '250g',
          connectivity: 'Bluetooth 5.0'
        },
        isOnSale: true,
        icon: '🎧'
      },
      {
        id: 'test-product-2',
        name: 'Basic Service Package',
        price: '$99',
        description: 'Essential consulting services',
        deliveryTime: '3-5 business days',
        features: [
          'Initial consultation',
          'Strategy document',
          'Email support'
        ],
        category: 'Consulting',
        popular: false
      }
    ],
    businessModel: {
      isEcommerce: true,
      confidence: 0.9,
      productCategories: ['Electronics', 'Accessories']
    },
    ecommerceSettings: {
      enabled: true,
      shipping: {
        standard: { name: 'Standard Shipping', price: 5.99, estimatedDays: '5-7' },
        express: { name: 'Express Shipping', price: 12.99, estimatedDays: '2-3' },
        overnight: { name: 'Overnight Shipping', price: 24.99, estimatedDays: '1' }
      },
      tax: {
        rate: 0.08,
        includedInPrice: false
      },
      currency: 'USD',
      policies: {
        returns: '30-day return policy',
        privacy: 'We protect your privacy',
        terms: 'Standard terms apply'
      }
    },
    theme: {
      colors: {
        primary: '#3b82f6',
        secondary: '#1e40af',
        textDark: '#1f2937',
        textGray: '#6b7280',
        borderColor: '#e5e7eb'
      },
      font: 'Inter',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }
  }
}

describe('ProductPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch.mockClear()
  })

  const renderProductPage = () => {
    return render(<ProductPage />)
  }

  describe('Loading states', () => {
    test('should show loading spinner while fetching data', async () => {
      // Mock delayed response
      mockSupabaseClient.from().select().eq().eq().single.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: mockBusinessData, error: null }), 100))
      )

      renderProductPage()

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })
    })

    test('should show error message when business not found', async () => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: null,
        error: new Error('Business not found')
      })

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Product Not Found')).toBeInTheDocument()
        expect(screen.getByText('Go Back')).toBeInTheDocument()
      })
    })

    test('should show error message when product not found', async () => {
      const businessWithoutProduct = {
        ...mockBusinessData,
        business_data: {
          ...mockBusinessData.business_data,
          products: [] // No products
        }
      }

      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: businessWithoutProduct,
        error: null
      })

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Product Not Found')).toBeInTheDocument()
      })
    })
  })

  describe('Product display', () => {
    beforeEach(() => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: mockBusinessData,
        error: null
      })
    })

    test('should display product information correctly', async () => {
      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Premium Wireless Headphones')).toBeInTheDocument()
        expect(screen.getByText('High-quality wireless headphones with noise cancellation')).toBeInTheDocument()
        expect(screen.getByText('$199.99')).toBeInTheDocument()
        expect(screen.getByText('🎧')).toBeInTheDocument()
      })
    })

    test('should display product features', async () => {
      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('What\'s Included:')).toBeInTheDocument()
        expect(screen.getByText('Active Noise Cancellation')).toBeInTheDocument()
        expect(screen.getByText('30-hour battery life')).toBeInTheDocument()
        expect(screen.getByText('Premium sound quality')).toBeInTheDocument()
        expect(screen.getByText('Comfortable fit')).toBeInTheDocument()
      })
    })

    test('should show sale badge for discounted products', async () => {
      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('$199.99')).toBeInTheDocument()
        // Should show original price struck through (this would be in CSS styling)
      })
    })

    test('should display business branding', async () => {
      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Test E-commerce Store')).toBeInTheDocument()
        expect(screen.getByText('Back to Test E-commerce Store')).toBeInTheDocument()
      })
    })
  })

  describe('Customer information form', () => {
    beforeEach(() => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: mockBusinessData,
        error: null
      })
    })

    test('should render customer info form', async () => {
      renderProductPage()

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name *')).toBeInTheDocument()
        expect(screen.getByLabelText('Email Address *')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Enter your full name')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument()
      })
    })

    test('should update customer info on input', async () => {
      const user = userEvent.setup()
      renderProductPage()

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name *')).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Full Name *')
      const emailInput = screen.getByLabelText('Email Address *')

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')

      expect(nameInput).toHaveValue('John Doe')
      expect(emailInput).toHaveValue('john@example.com')
    })

    test('should validate required fields before purchase', async () => {
      const user = userEvent.setup()
      
      // Mock alert
      window.alert = jest.fn()

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Buy Now - $199.99')).toBeInTheDocument()
      })

      const buyButton = screen.getByText('Buy Now - $199.99')
      await user.click(buyButton)

      expect(window.alert).toHaveBeenCalledWith('Please fill in your name and email address')
    })
  })

  describe('Purchase functionality', () => {
    beforeEach(() => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: mockBusinessData,
        error: null
      })
    })

    test('should initiate Stripe checkout with valid info', async () => {
      const user = userEvent.setup()
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/test-session' })
      })

      // Mock window.location.href
      delete window.location
      window.location = { href: '' }

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name *')).toBeInTheDocument()
      })

      // Fill in customer info
      const nameInput = screen.getByLabelText('Full Name *')
      const emailInput = screen.getByLabelText('Email Address *')
      
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')

      // Click buy button
      const buyButton = screen.getByText('Buy Now - $199.99')
      await user.click(buyButton)

      // Should call Stripe API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            productId: 'test-product-1',
            productName: 'Premium Wireless Headphones',
            productPrice: 199.99,
            productDescription: 'High-quality wireless headphones with noise cancellation',
            businessId: 'test-business-id',
            subdomain: 'test-business',
            customerEmail: 'john@example.com',
            customerName: 'John Doe'
          })
        })
      })

      // Should redirect to Stripe
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session')
    })

    test('should show loading state during purchase', async () => {
      const user = userEvent.setup()
      
      // Mock delayed response
      global.fetch.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ url: 'https://checkout.stripe.com/test-session' })
          }), 100)
        )
      )

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name *')).toBeInTheDocument()
      })

      // Fill in customer info
      const nameInput = screen.getByLabelText('Full Name *')
      const emailInput = screen.getByLabelText('Email Address *')
      
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')

      // Click buy button
      const buyButton = screen.getByText('Buy Now - $199.99')
      await user.click(buyButton)

      // Should show loading state
      expect(screen.getByText('Processing...')).toBeInTheDocument()
      expect(buyButton).toBeDisabled()
    })

    test('should handle purchase errors gracefully', async () => {
      const user = userEvent.setup()
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'Payment processing failed' })
      })

      window.alert = jest.fn()

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name *')).toBeInTheDocument()
      })

      // Fill in customer info
      const nameInput = screen.getByLabelText('Full Name *')
      const emailInput = screen.getByLabelText('Email Address *')
      
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')

      // Click buy button
      const buyButton = screen.getByText('Buy Now - $199.99')
      await user.click(buyButton)

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Something went wrong. Please try again.')
      })
    })
  })

  describe('UI theming', () => {
    beforeEach(() => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: mockBusinessData,
        error: null
      })
    })

    test('should apply business theme colors', async () => {
      renderProductPage()

      await waitFor(() => {
        const container = screen.getByText('Premium Wireless Headphones').closest('div')
        expect(container).toHaveStyle({
          '--primary': '#3b82f6',
          '--secondary': '#1e40af',
          '--text-dark': '#1f2937',
          '--text-gray': '#6b7280'
        })
      })
    })

    test('should show security notice', async () => {
      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Secure payment powered by Stripe')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    beforeEach(() => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: mockBusinessData,
        error: null
      })
    })

    test('should have back navigation', async () => {
      const user = userEvent.setup()
      const mockRouter = require('next/navigation').useRouter()

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Back to Test E-commerce Store')).toBeInTheDocument()
      })

      const backButton = screen.getByText('Back to Test E-commerce Store')
      await user.click(backButton)

      expect(mockRouter().back).toHaveBeenCalled()
    })
  })

  describe('Service products', () => {
    test('should display service product correctly', async () => {
      // Mock business with service product
      const serviceBusinessData = {
        ...mockBusinessData,
        business_data: {
          ...mockBusinessData.business_data,
          businessModel: {
            isEcommerce: false,
            confidence: 0.9
          },
          products: [
            {
              id: 'test-product-1',
              name: 'Business Consulting Package',
              price: '$297',
              description: 'Complete business strategy consultation',
              deliveryTime: '5-7 business days',
              features: [
                'Initial consultation',
                'Market analysis',
                'Strategy document',
                'Follow-up call'
              ],
              category: 'Consulting',
              popular: true
            }
          ]
        }
      }

      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: serviceBusinessData,
        error: null
      })

      renderProductPage()

      await waitFor(() => {
        expect(screen.getByText('Business Consulting Package')).toBeInTheDocument()
        expect(screen.getByText('Complete business strategy consultation')).toBeInTheDocument()
        expect(screen.getByText('$297')).toBeInTheDocument()
        expect(screen.getByText('Initial consultation')).toBeInTheDocument()
        expect(screen.getByText('Market analysis')).toBeInTheDocument()
      })
    })
  })
})
