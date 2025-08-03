import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useParams() {
    return {
      subdomain: 'test-business',
      productId: 'test-product-1',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock Supabase
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: () => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-business-id',
                name: 'Test Business',
                subdomain: 'test-business',
                status: 'ready',
                business_data: {
                  businessName: 'Test Business',
                  products: [
                    {
                      id: 'test-product-1',
                      name: 'Test Product',
                      price: '$99.99',
                      description: 'A test product',
                      features: ['Feature 1', 'Feature 2'],
                      category: 'Test Category',
                      inStock: true,
                      stock: 10,
                    }
                  ],
                  businessModel: {
                    isEcommerce: true,
                    confidence: 0.9,
                    productCategories: ['Electronics'],
                  },
                  ecommerceSettings: {
                    enabled: true,
                    shipping: {
                      standard: { name: 'Standard', price: 5.99, estimatedDays: '5-7' },
                      express: { name: 'Express', price: 12.99, estimatedDays: '2-3' },
                    },
                    tax: { rate: 0.08, includedInPrice: false },
                    currency: 'USD',
                  },
                  theme: {
                    colors: {
                      primary: '#3b82f6',
                      secondary: '#1e40af',
                      textDark: '#1f2937',
                      textGray: '#6b7280',
                    }
                  }
                }
              },
              error: null,
            })
          })
        })
      })
    })
  }),
}))

// Mock global fetch
global.fetch = jest.fn()

// Mock window.location
delete window.location
window.location = { href: '' }
