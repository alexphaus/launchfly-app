/**
 * Tests for the AI-powered business model determination functionality
 */

import { jest } from '@jest/globals'

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
}

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI)
})

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    })
  }))
}))

describe('Business Model Determination', () => {
  let launchModule

  beforeEach(async () => {
    jest.clearAllMocks()
    // Dynamic import to ensure mocks are applied
    launchModule = await import('../src/core/launch.js')
  })

  describe('AI-powered classification', () => {
    test('should classify e-commerce business correctly', async () => {
      // Mock OpenAI response for e-commerce business
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              businessModel: 'ecommerce',
              confidence: 0.95,
              reasoning: 'Business involves selling physical products like clothing and accessories',
              productCategories: ['Clothing', 'Accessories', 'Shoes']
            })
          }
        }]
      })

      const opportunity = {
        businessName: 'Fashion Forward',
        niche: 'fashion',
        solution: 'Trendy clothing for young professionals',
        problem: 'Lack of affordable professional wear',
        targetMarket: 'Young professionals aged 25-35'
      }

      // Access the internal determineBusinessModel function
      // Note: This would need to be exported or made testable
      const result = await launchModule.determineBusinessModel(opportunity)

      expect(result.isEcommerce).toBe(true)
      expect(result.confidence).toBe(0.95)
      expect(result.productCategories).toContain('Clothing')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('business model analyst')
            })
          ]),
          response_format: { type: 'json_object' }
        })
      )
    })

    test('should classify service business correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              businessModel: 'service',
              confidence: 0.92,
              reasoning: 'Business provides consulting and professional services',
              productCategories: []
            })
          }
        }]
      })

      const opportunity = {
        businessName: 'Marketing Masters',
        niche: 'marketing consulting',
        solution: 'Digital marketing strategies for small businesses',
        problem: 'Small businesses struggle with online marketing',
        targetMarket: 'Small business owners'
      }

      const result = await launchModule.determineBusinessModel(opportunity)

      expect(result.isEcommerce).toBe(false)
      expect(result.confidence).toBe(0.92)
      expect(result.productCategories).toEqual([])
    })

    test('should fallback to keyword analysis when OpenAI fails', async () => {
      // Mock OpenAI to throw an error
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'))

      const opportunity = {
        businessName: 'Tech Store',
        niche: 'electronics',
        solution: 'Latest gadgets and devices',
        problem: 'Hard to find quality electronics',
        targetMarket: 'Tech enthusiasts'
      }

      const result = await launchModule.determineBusinessModel(opportunity)

      // Should fallback to keyword-based detection
      expect(result.isEcommerce).toBe(true)
      expect(result.reasoning).toContain('product indicators')
      expect(typeof result.confidence).toBe('number')
    })
  })

  describe('Product generation based on business model', () => {
    test('should generate e-commerce products for e-commerce business', async () => {
      // Mock determineBusinessModel to return e-commerce
      jest.spyOn(launchModule, 'determineBusinessModel').mockResolvedValueOnce({
        isEcommerce: true,
        confidence: 0.9,
        productCategories: ['Electronics', 'Gadgets'],
        reasoning: 'E-commerce business'
      })

      // Mock OpenAI response for product creation
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              businessModel: 'ecommerce',
              totalItems: 12,
              products: [
                {
                  id: 'prod-001',
                  name: 'Wireless Headphones',
                  price: 99.99,
                  description: 'High-quality wireless headphones',
                  image: 'https://images.unsplash.com/photo-test',
                  category: 'Electronics',
                  inStock: true,
                  stock: 25,
                  features: ['Noise cancellation', 'Long battery life'],
                  specifications: { battery: '20 hours' },
                  isOnSale: false
                }
              ]
            })
          }
        }]
      })

      const opportunity = {
        businessName: 'Tech Store',
        niche: 'electronics',
        solution: 'Quality electronics',
        problem: 'Hard to find reliable tech',
        targetMarket: 'Tech enthusiasts'
      }

      const products = await launchModule.createProducts(opportunity)

      expect(Array.isArray(products)).toBe(true)
      expect(products.length).toBeGreaterThan(0)
      expect(products[0]).toHaveProperty('id')
      expect(products[0]).toHaveProperty('name')
      expect(products[0]).toHaveProperty('price')
      expect(products[0]).toHaveProperty('inStock')
    })

    test('should generate service packages for service business', async () => {
      // Mock determineBusinessModel to return service
      jest.spyOn(launchModule, 'determineBusinessModel').mockResolvedValueOnce({
        isEcommerce: false,
        confidence: 0.9,
        productCategories: [],
        reasoning: 'Service business'
      })

      // Mock OpenAI response for service creation
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              businessModel: 'service',
              totalItems: 3,
              products: [
                {
                  id: 'svc-001',
                  name: 'Basic Consulting',
                  price: 297,
                  description: 'Essential consulting services',
                  deliveryTime: '3-5 business days',
                  features: ['Initial consultation', 'Strategy document'],
                  category: 'Consulting',
                  popular: false
                }
              ]
            })
          }
        }]
      })

      const opportunity = {
        businessName: 'Business Consultants',
        niche: 'business consulting',
        solution: 'Strategic business advice',
        problem: 'Businesses need strategic guidance',
        targetMarket: 'Small business owners'
      }

      const products = await launchModule.createProducts(opportunity)

      expect(Array.isArray(products)).toBe(true)
      expect(products.length).toBeGreaterThan(0)
      expect(products[0]).toHaveProperty('id')
      expect(products[0]).toHaveProperty('name')
      expect(products[0]).toHaveProperty('price')
      expect(products[0]).toHaveProperty('deliveryTime')
      expect(products[0]).not.toHaveProperty('inStock') // Services don't have stock
    })
  })

  describe('E-commerce settings generation', () => {
    test('should include e-commerce settings for e-commerce business', async () => {
      // Mock all required functions
      jest.spyOn(launchModule, 'determineBusinessModel').mockResolvedValueOnce({
        isEcommerce: true,
        confidence: 0.9,
        productCategories: ['Electronics'],
        reasoning: 'E-commerce business'
      })

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ // generateLogo
          choices: [{ message: { content: '🛍️' } }]
        })
        .mockResolvedValueOnce({ // generateWebsite
          choices: [{
            message: {
              content: JSON.stringify({
                theme: { colors: { primary: '#3b82f6' } },
                layout: []
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // createProducts
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'ecommerce',
                products: [{ id: 'test', name: 'Test Product', price: 99.99 }]
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // createMarketing
          choices: [{
            message: {
              content: JSON.stringify({
                acquisitionChannels: ['SEO'],
                contentTopics: ['Product reviews']
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // identifyTargetCustomers
          choices: [{
            message: {
              content: JSON.stringify({
                targetCustomers: ['Online shoppers']
              })
            }
          }]
        })

      const opportunity = {
        businessName: 'Test Store',
        niche: 'electronics',
        solution: 'Quality products',
        problem: 'Hard to find reliable products',
        targetMarket: 'Tech enthusiasts',
        profitPotential: 5000
      }

      const businessData = await launchModule.launchBusiness(opportunity, 'test-session', 'test-business')

      expect(businessData.businessModel.isEcommerce).toBe(true)
      expect(businessData.ecommerceSettings).toBeDefined()
      expect(businessData.ecommerceSettings.enabled).toBe(true)
      expect(businessData.ecommerceSettings.shipping).toBeDefined()
      expect(businessData.ecommerceSettings.tax).toBeDefined()
      expect(businessData.ecommerceSettings.currency).toBe('USD')
    })

    test('should include disabled e-commerce settings for service business', async () => {
      // Mock all required functions for service business
      jest.spyOn(launchModule, 'determineBusinessModel').mockResolvedValueOnce({
        isEcommerce: false,
        confidence: 0.9,
        productCategories: [],
        reasoning: 'Service business'
      })

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ // generateLogo
          choices: [{ message: { content: '💼' } }]
        })
        .mockResolvedValueOnce({ // generateWebsite
          choices: [{
            message: {
              content: JSON.stringify({
                theme: { colors: { primary: '#3b82f6' } },
                layout: []
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // createProducts
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'service',
                products: [{ id: 'test', name: 'Test Service', price: 297 }]
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // createMarketing
          choices: [{
            message: {
              content: JSON.stringify({
                acquisitionChannels: ['Networking'],
                contentTopics: ['Industry insights']
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // identifyTargetCustomers
          choices: [{
            message: {
              content: JSON.stringify({
                targetCustomers: ['Business owners']
              })
            }
          }]
        })

      const opportunity = {
        businessName: 'Test Consulting',
        niche: 'business consulting',
        solution: 'Strategic advice',
        problem: 'Businesses need guidance',
        targetMarket: 'Small business owners',
        profitPotential: 5000
      }

      const businessData = await launchModule.launchBusiness(opportunity, 'test-session', 'test-business')

      expect(businessData.businessModel.isEcommerce).toBe(false)
      expect(businessData.ecommerceSettings).toBeDefined()
      expect(businessData.ecommerceSettings.enabled).toBe(false)
      expect(businessData.ecommerceSettings.policies.returns).toBe('100% satisfaction guarantee')
    })
  })

  describe('Error handling and fallbacks', () => {
    test('should handle OpenAI API failures gracefully', async () => {
      // Mock OpenAI to fail on all calls
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

      const opportunity = {
        businessName: 'Test Business',
        niche: 'technology',
        solution: 'Tech solutions',
        problem: 'Tech problems',
        targetMarket: 'Tech users',
        profitPotential: 5000
      }

      // Should not throw error and should return fallback data
      const businessData = await launchModule.launchBusiness(opportunity, 'test-session', 'test-business')

      expect(businessData).toBeDefined()
      expect(businessData.businessName).toBe('Test Business')
      expect(businessData.products).toBeDefined()
      expect(Array.isArray(businessData.products)).toBe(true)
    })

    test('should use keyword fallback when AI classification fails', async () => {
      const opportunity = {
        businessName: 'Clothing Store',
        niche: 'fashion retail',
        solution: 'Trendy clothes and accessories',
        problem: 'Finding fashionable clothing',
        targetMarket: 'Fashion-conscious consumers'
      }

      // Mock OpenAI to fail
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'))

      const result = await launchModule.determineBusinessModel(opportunity)

      // Should fallback to keyword analysis and detect e-commerce
      expect(result.isEcommerce).toBe(true)
      expect(result.reasoning).toContain('product indicators')
      expect(result.productCategories).toBeDefined()
    })
  })
})
