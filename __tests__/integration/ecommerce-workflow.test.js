/**
 * Integration tests for E-commerce workflow
 * Tests the complete flow from business generation to product purchase
 */

import { jest } from '@jest/globals'

// Mock all external dependencies
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

const mockSupabase = {
  from: jest.fn(() => ({
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [{ id: 'test-business-id' }], error: null }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('E-commerce Integration Tests', () => {
  let launchModule

  beforeEach(async () => {
    jest.clearAllMocks()
    global.fetch.mockClear()
    
    // Import the launch module with mocks applied
    launchModule = await import('../../src/core/launch.js')
  })

  describe('Complete E-commerce Business Generation', () => {
    test('should generate complete e-commerce business with products and settings', async () => {
      // Mock OpenAI responses for all components
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ // generateLogo
          choices: [{ message: { content: '🛍️' } }]
        })
        .mockResolvedValueOnce({ // generateWebsite
          choices: [{
            message: {
              content: JSON.stringify({
                theme: {
                  colors: {
                    primary: '#3b82f6',
                    secondary: '#1e40af',
                    textDark: '#1f2937',
                    textGray: '#6b7280'
                  },
                  font: 'Inter',
                  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                },
                layout: [
                  {
                    component: 'NavBar',
                    props: { businessName: 'Fashion Store', logo: '🛍️' }
                  },
                  {
                    component: 'Hero',
                    props: {
                      title: 'Trendy Fashion for Everyone',
                      subtitle: 'Discover the latest trends',
                      backgroundImage: 'https://images.unsplash.com/photo-fashion'
                    }
                  }
                ]
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // determineBusinessModel
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'ecommerce',
                confidence: 0.95,
                reasoning: 'Business involves selling clothing and fashion accessories',
                productCategories: ['Clothing', 'Accessories', 'Shoes']
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // createProducts
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'ecommerce',
                totalItems: 10,
                products: [
                  {
                    id: 'prod-001',
                    name: 'Premium T-Shirt',
                    price: 29.99,
                    originalPrice: 39.99,
                    description: 'Comfortable cotton t-shirt with modern fit',
                    image: 'https://images.unsplash.com/photo-tshirt',
                    category: 'Clothing',
                    inStock: true,
                    stock: 50,
                    features: ['100% Cotton', 'Modern Fit', 'Machine Washable'],
                    specifications: { material: 'Cotton', sizes: 'S-XL' },
                    isOnSale: true
                  },
                  {
                    id: 'prod-002',
                    name: 'Designer Jeans',
                    price: 89.99,
                    description: 'High-quality denim with premium finish',
                    image: 'https://images.unsplash.com/photo-jeans',
                    category: 'Clothing',
                    inStock: true,
                    stock: 25,
                    features: ['Premium Denim', 'Slim Fit', 'Durable'],
                    specifications: { material: 'Denim', sizes: '28-38' },
                    isOnSale: false
                  },
                  {
                    id: 'prod-003',
                    name: 'Leather Handbag',
                    price: 149.99,
                    description: 'Elegant leather handbag for any occasion',
                    image: 'https://images.unsplash.com/photo-handbag',
                    category: 'Accessories',
                    inStock: true,
                    stock: 15,
                    features: ['Genuine Leather', 'Multiple Compartments', 'Adjustable Strap'],
                    specifications: { material: 'Leather', dimensions: '12x8x4 inches' },
                    isOnSale: false
                  }
                ]
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // createMarketing
          choices: [{
            message: {
              content: JSON.stringify({
                acquisitionChannels: ['Social Media Marketing', 'Google Ads', 'Influencer Partnerships'],
                contentTopics: ['Fashion Trends', 'Styling Tips', 'Product Spotlights'],
                socialMediaPosts: [
                  'Introducing our new collection - modern fashion for everyone',
                  'Check out our top 5 styling tips for the season',
                  'Limited time offer: 20% off all premium items'
                ],
                elevatorPitch: 'We provide trendy, affordable fashion for style-conscious consumers',
                sellingPoints: [
                  'Latest fashion trends at affordable prices',
                  'High-quality materials and craftsmanship',
                  'Fast shipping and easy returns'
                ]
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // identifyTargetCustomers
          choices: [{
            message: {
              content: JSON.stringify({
                targetCustomers: [
                  'Fashion-forward millennials aged 25-35 looking for trendy, affordable clothing',
                  'Young professionals who want to look stylish without breaking the bank',
                  'College students and young adults who follow fashion trends on social media'
                ]
              })
            }
          }]
        })

      const opportunity = {
        businessName: 'TrendyFashion',
        niche: 'fashion retail',
        solution: 'Affordable trendy clothing for young professionals',
        problem: 'Hard to find stylish, affordable fashion',
        targetMarket: 'Young professionals aged 25-35',
        profitPotential: 8000
      }

      // Generate the complete business
      const businessData = await launchModule.launchBusiness(opportunity, 'test-session', 'test-business')

      // Verify business model classification
      expect(businessData.businessModel).toBeDefined()
      expect(businessData.businessModel.isEcommerce).toBe(true)
      expect(businessData.businessModel.confidence).toBe(0.95)
      expect(businessData.businessModel.productCategories).toContain('Clothing')

      // Verify products were generated
      expect(businessData.products).toBeDefined()
      expect(Array.isArray(businessData.products)).toBe(true)
      expect(businessData.products.length).toBe(3)

      // Verify product structure for e-commerce
      const firstProduct = businessData.products[0]
      expect(firstProduct).toHaveProperty('id')
      expect(firstProduct).toHaveProperty('name')
      expect(firstProduct).toHaveProperty('price')
      expect(firstProduct).toHaveProperty('inStock')
      expect(firstProduct).toHaveProperty('stock')
      expect(firstProduct).toHaveProperty('category')
      expect(firstProduct).toHaveProperty('isOnSale')

      // Verify e-commerce settings
      expect(businessData.ecommerceSettings).toBeDefined()
      expect(businessData.ecommerceSettings.enabled).toBe(true)
      expect(businessData.ecommerceSettings.shipping).toBeDefined()
      expect(businessData.ecommerceSettings.tax).toBeDefined()
      expect(businessData.ecommerceSettings.currency).toBe('USD')

      // Verify shipping settings
      expect(businessData.ecommerceSettings.shipping.standard).toBeDefined()
      expect(businessData.ecommerceSettings.shipping.express).toBeDefined()
      expect(businessData.ecommerceSettings.shipping.overnight).toBeDefined()

      // Verify tax settings
      expect(businessData.ecommerceSettings.tax.rate).toBe(0.08)
      expect(businessData.ecommerceSettings.tax.includedInPrice).toBe(false)

      // Verify policies
      expect(businessData.ecommerceSettings.policies.returns).toBe('30-day return policy')

      // Verify website theme
      expect(businessData.theme).toBeDefined()
      expect(businessData.theme.colors.primary).toBe('#3b82f6')

      // Verify marketing data
      expect(businessData.marketing).toBeDefined()
      expect(businessData.marketing.acquisitionChannels).toContain('Social Media Marketing')

      // Verify target customers
      expect(businessData.targetCustomers).toBeDefined()
      expect(businessData.targetCustomers.length).toBe(3)
    })

    test('should generate service business correctly', async () => {
      // Mock OpenAI responses for service business
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ // generateLogo
          choices: [{ message: { content: '💼' } }]
        })
        .mockResolvedValueOnce({ // generateWebsite - service focused
          choices: [{
            message: {
              content: JSON.stringify({
                theme: {
                  colors: {
                    primary: '#059669',
                    secondary: '#047857',
                    textDark: '#1f2937',
                    textGray: '#6b7280'
                  },
                  font: 'Inter',
                  gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                },
                layout: [
                  {
                    component: 'NavBar',
                    props: { businessName: 'Business Consulting Pro', logo: '💼' }
                  },
                  {
                    component: 'Hero',
                    props: {
                      title: 'Expert Business Consulting',
                      subtitle: 'Strategic guidance for growth',
                      backgroundImage: 'https://images.unsplash.com/photo-business'
                    }
                  }
                ]
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // determineBusinessModel
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
        .mockResolvedValueOnce({ // createProducts (services)
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'service',
                totalItems: 3,
                products: [
                  {
                    id: 'svc-001',
                    name: 'Basic Consulting Package',
                    price: 297,
                    description: 'Essential business strategy consultation',
                    deliveryTime: '3-5 business days',
                    features: [
                      'Initial consultation call',
                      'Business analysis report',
                      'Strategic recommendations',
                      'Email support for 30 days'
                    ],
                    category: 'Consulting',
                    popular: false
                  },
                  {
                    id: 'svc-002',
                    name: 'Professional Package',
                    price: 597,
                    description: 'Comprehensive business transformation',
                    deliveryTime: '1-2 weeks',
                    features: [
                      'All Basic features',
                      'Market analysis',
                      'Competitive research',
                      'Implementation roadmap',
                      'Priority support'
                    ],
                    category: 'Consulting',
                    popular: true
                  },
                  {
                    id: 'svc-003',
                    name: 'Enterprise Package',
                    price: 1297,
                    description: 'Complete business optimization',
                    deliveryTime: '2-4 weeks',
                    features: [
                      'All Professional features',
                      'Custom strategy development',
                      'Team training sessions',
                      'Ongoing support for 6 months',
                      'Dedicated consultant'
                    ],
                    category: 'Consulting',
                    popular: false
                  }
                ]
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // createMarketing
          choices: [{
            message: {
              content: JSON.stringify({
                acquisitionChannels: ['LinkedIn Marketing', 'Content Marketing', 'Referral Program'],
                contentTopics: ['Business Strategy', 'Growth Hacking', 'Industry Insights'],
                elevatorPitch: 'We help businesses optimize operations and accelerate growth'
              })
            }
          }]
        })
        .mockResolvedValueOnce({ // identifyTargetCustomers
          choices: [{
            message: {
              content: JSON.stringify({
                targetCustomers: [
                  'Small business owners looking to scale their operations',
                  'Startup founders needing strategic guidance',
                  'Mid-size companies facing growth challenges'
                ]
              })
            }
          }]
        })

      const opportunity = {
        businessName: 'Business Consulting Pro',
        niche: 'business consulting',
        solution: 'Strategic business consulting for growth',
        problem: 'Businesses struggle with strategic planning',
        targetMarket: 'Small to medium business owners',
        profitPotential: 12000
      }

      const businessData = await launchModule.launchBusiness(opportunity, 'test-session', 'test-business')

      // Verify service business model
      expect(businessData.businessModel.isEcommerce).toBe(false)
      expect(businessData.businessModel.confidence).toBe(0.92)

      // Verify service packages
      expect(businessData.products).toBeDefined()
      expect(businessData.products.length).toBe(3)

      const firstService = businessData.products[0]
      expect(firstService).toHaveProperty('deliveryTime')
      expect(firstService).toHaveProperty('features')
      expect(firstService).not.toHaveProperty('inStock') // Services don't have stock
      expect(firstService).not.toHaveProperty('specifications')

      // Verify e-commerce settings are disabled but present
      expect(businessData.ecommerceSettings.enabled).toBe(false)
      expect(businessData.ecommerceSettings.policies.returns).toBe('100% satisfaction guarantee')
    })
  })

  describe('Business Type Detection Accuracy', () => {
    const testCases = [
      {
        name: 'Fashion E-commerce',
        opportunity: {
          businessName: 'StyleHub',
          niche: 'fashion retail',
          solution: 'Trendy clothing and accessories',
          problem: 'Hard to find affordable fashion'
        },
        expectedType: 'ecommerce',
        expectedCategories: ['Clothing', 'Accessories']
      },
      {
        name: 'Electronics Store',
        opportunity: {
          businessName: 'TechWorld',
          niche: 'electronics',  
          solution: 'Latest gadgets and devices',
          problem: 'Expensive electronics elsewhere'
        },
        expectedType: 'ecommerce',
        expectedCategories: ['Electronics', 'Gadgets']
      },
      {
        name: 'Digital Marketing Agency',
        opportunity: {
          businessName: 'Digital Growth Co',
          niche: 'digital marketing',
          solution: 'Marketing services for small businesses',
          problem: 'Small businesses struggle with online marketing'
        },
        expectedType: 'service'
      },
      {
        name: 'Business Consulting',
        opportunity: {
          businessName: 'Strategy Partners',
          niche: 'business consulting',
          solution: 'Strategic business advice and planning',
          problem: 'Businesses need expert guidance'
        },
        expectedType: 'service'
      }
    ]

    testCases.forEach(testCase => {
      test(`should correctly classify ${testCase.name}`, async () => {
        // Mock AI response for this test case
        mockOpenAI.chat.completions.create.mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: testCase.expectedType,
                confidence: 0.9,
                reasoning: `Classification based on business characteristics`,
                productCategories: testCase.expectedCategories || []
              })
            }
          }]
        })

        const result = await launchModule.determineBusinessModel(testCase.opportunity)

        expect(result.isEcommerce).toBe(testCase.expectedType === 'ecommerce')
        if (testCase.expectedCategories) {
          expect(result.productCategories).toEqual(expect.arrayContaining(testCase.expectedCategories))
        }
      })
    })
  })

  describe('Fallback Mechanisms', () => {
    test('should fallback to keyword analysis when AI fails', async () => {
      // Mock AI to fail
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'))

      const ecommerceOpportunity = {
        businessName: 'Clothing Store',
        niche: 'fashion retail',
        solution: 'Trendy clothes and accessories',
        problem: 'Finding fashionable clothing'
      }

      const result = await launchModule.determineBusinessModel(ecommerceOpportunity)

      // Should use keyword fallback and still classify correctly
      expect(result.isEcommerce).toBe(true)
      expect(result.reasoning).toContain('product indicators')
    })

    test('should provide fallback products when AI fails', async () => {
      // Mock AI to fail for product generation
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ // determineBusinessModel succeeds
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'ecommerce',
                confidence: 0.9,
                productCategories: ['Electronics']
              })
            }
          }]
        })
        .mockRejectedValueOnce(new Error('Product generation failed')) // createProducts fails

      const opportunity = {
        businessName: 'Tech Store',
        niche: 'electronics',
        solution: 'Quality electronics',
        problem: 'Expensive tech elsewhere'
      }

      const products = await launchModule.createProducts(opportunity)

      // Should return fallback e-commerce products
      expect(Array.isArray(products)).toBe(true)
      expect(products.length).toBeGreaterThan(0)
      expect(products[0]).toHaveProperty('inStock')
      expect(products[0]).toHaveProperty('stock')
    })
  })

  describe('Product Quality and Variety', () => {
    test('should generate diverse e-commerce product catalog', async () => {
      // Mock business model determination
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'ecommerce',
                confidence: 0.95,
                productCategories: ['Home & Garden', 'Kitchen', 'Decor']
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'ecommerce',
                totalItems: 15,
                products: Array.from({ length: 15 }, (_, i) => ({
                  id: `prod-${(i + 1).toString().padStart(3, '0')}`,
                  name: `Product ${i + 1}`,
                  price: Math.round((Math.random() * 200 + 20) * 100) / 100,
                  category: ['Home & Garden', 'Kitchen', 'Decor'][i % 3],
                  inStock: Math.random() > 0.1, // 90% in stock
                  stock: Math.floor(Math.random() * 50) + 1,
                  isOnSale: Math.random() > 0.7 // 30% on sale
                }))
              })
            }
          }]
        })

      const opportunity = {
        businessName: 'Home Essentials',
        niche: 'home and garden',
        solution: 'Quality home improvement products',
        problem: 'Expensive home goods'
      }

      const products = await launchModule.createProducts(opportunity)

      expect(products.length).toBe(15)
      
      // Check price variety
      const prices = products.map(p => p.price)
      expect(Math.max(...prices)).toBeGreaterThan(Math.min(...prices))
      
      // Check category diversity
      const categories = [...new Set(products.map(p => p.category))]
      expect(categories.length).toBeGreaterThan(1)
      
      // Check that some products are on sale
      const onSaleProducts = products.filter(p => p.isOnSale)
      expect(onSaleProducts.length).toBeGreaterThan(0)
    })

    test('should generate appropriate service tiers', async () => {
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'service',
                confidence: 0.92,
                productCategories: []
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                businessModel: 'service',
                totalItems: 4,
                products: [
                  { id: 'svc-1', name: 'Starter', price: 97, popular: false, deliveryTime: '2-3 days' },
                  { id: 'svc-2', name: 'Professional', price: 297, popular: true, deliveryTime: '5-7 days' },
                  { id: 'svc-3', name: 'Premium', price: 597, popular: false, deliveryTime: '1-2 weeks' },
                  { id: 'svc-4', name: 'Enterprise', price: 1297, popular: false, deliveryTime: '2-4 weeks' }
                ]
              })
            }
          }]
        })

      const opportunity = {
        businessName: 'Web Design Pro',
        niche: 'web design',
        solution: 'Professional website design services',
        problem: 'Businesses need professional websites'
      }

      const services = await launchModule.createProducts(opportunity)

      expect(services.length).toBe(4)
      
      // Check price progression
      const prices = services.map(s => s.price).sort((a, b) => a - b)
      expect(prices[0]).toBeLessThan(prices[1])
      expect(prices[1]).toBeLessThan(prices[2])
      expect(prices[2]).toBeLessThan(prices[3])
      
      // Check that one service is marked as popular
      const popularServices = services.filter(s => s.popular)
      expect(popularServices.length).toBe(1)
      
      // All should have delivery times
      services.forEach(service => {
        expect(service).toHaveProperty('deliveryTime')
      })
    })
  })
})
