/**
 * Test utilities for E-commerce testing
 */

export const mockBusinessData = {
  ecommerce: {
    id: 'test-ecommerce-id',
    name: 'Test E-commerce Store',
    subdomain: 'test-store',
    status: 'ready',
    business_data: {
      businessName: 'Test E-commerce Store',
      businessModel: {
        isEcommerce: true,
        confidence: 0.9,
        productCategories: ['Electronics', 'Accessories']
      },
      products: [
        {
          id: 'prod-001',
          name: 'Wireless Headphones',
          price: '$99.99',
          originalPrice: '$129.99',
          description: 'High-quality wireless headphones',
          image: 'https://images.unsplash.com/photo-headphones',
          category: 'Electronics',
          inStock: true,
          stock: 25,
          features: ['Noise cancellation', '20-hour battery'],
          isOnSale: true
        },
        {
          id: 'prod-002',
          name: 'Phone Case',
          price: '$24.99',
          description: 'Protective phone case',
          image: 'https://images.unsplash.com/photo-phone-case',
          category: 'Accessories',
          inStock: true,
          stock: 50,
          features: ['Drop protection', 'Wireless charging compatible'],
          isOnSale: false
        }
      ],
      ecommerceSettings: {
        enabled: true,
        shipping: {
          standard: { name: 'Standard', price: 5.99, estimatedDays: '5-7' },
          express: { name: 'Express', price: 12.99, estimatedDays: '2-3' }
        },
        tax: { rate: 0.08, includedInPrice: false },
        currency: 'USD'
      },
      theme: {
        colors: {
          primary: '#3b82f6',
          secondary: '#1e40af',
          textDark: '#1f2937',
          textGray: '#6b7280'
        }
      }
    }
  },
  service: {
    id: 'test-service-id',
    name: 'Test Consulting',
    subdomain: 'test-consulting',
    status: 'ready',
    business_data: {
      businessName: 'Test Consulting',
      businessModel: {
        isEcommerce: false,
        confidence: 0.9,
        productCategories: []
      },
      products: [
        {
          id: 'svc-001',
          name: 'Basic Consulting',
          price: '$297',
          description: 'Essential consulting services',
          deliveryTime: '3-5 business days',
          features: ['Initial consultation', 'Strategy document'],
          category: 'Consulting',
          popular: false
        },
        {
          id: 'svc-002',
          name: 'Premium Consulting',
          price: '$597',
          description: 'Comprehensive consulting package',
          deliveryTime: '1-2 weeks',
          features: ['All Basic features', 'Implementation plan'],
          category: 'Consulting',
          popular: true
        }
      ],
      ecommerceSettings: {
        enabled: false,
        policies: { returns: '100% satisfaction guarantee' }
      },
      theme: {
        colors: {
          primary: '#059669',
          secondary: '#047857',
          textDark: '#1f2937',
          textGray: '#6b7280'
        }
      }
    }
  }
}

export const mockOpportunities = {
  ecommerce: {
    businessName: 'TechWorld',
    niche: 'electronics',
    solution: 'Latest gadgets and accessories',
    problem: 'Hard to find quality electronics',
    targetMarket: 'Tech enthusiasts',
    profitPotential: 8000
  },
  service: {
    businessName: 'Business Growth Co',
    niche: 'business consulting',
    solution: 'Strategic business consulting',
    problem: 'Businesses need expert guidance',
    targetMarket: 'Small business owners',
    profitPotential: 10000
  },
  fashion: {
    businessName: 'StyleHub',
    niche: 'fashion',
    solution: 'Trendy clothing for young professionals',
    problem: 'Affordable fashion is hard to find',
    targetMarket: 'Young professionals aged 25-35',
    profitPotential: 6000
  }
}

export const createMockSupabaseClient = (customResponses = {}) => {
  const defaultResponses = {
    businesses: { data: mockBusinessData.ecommerce, error: null },
    orders: { data: [{ id: 'order-123' }], error: null },
    sessions: { data: null, error: null }
  }

  const responses = { ...defaultResponses, ...customResponses }

  return {
    from: jest.fn((table) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve(responses[table] || responses.businesses))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve(responses[table] || responses.orders))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve(responses[table] || responses.sessions))
      }))
    }))
  }
}

export const createMockOpenAI = (customResponses = {}) => {
  const defaultResponses = {
    businessModel: {
      businessModel: 'ecommerce',
      confidence: 0.9,
      reasoning: 'AI classification',
      productCategories: ['Electronics']
    },
    products: {
      businessModel: 'ecommerce',
      totalItems: 5,
      products: [
        {
          id: 'test-prod-1',
          name: 'Test Product',
          price: 99.99,
          description: 'A test product',
          category: 'Electronics',
          inStock: true,
          stock: 10
        }
      ]
    },
    logo: '🚀',
    website: {
      theme: { colors: { primary: '#3b82f6' } },
      layout: [{ component: 'NavBar', props: {} }]
    },
    marketing: {
      acquisitionChannels: ['SEO'],
      contentTopics: ['Product reviews']
    },
    customers: {
      targetCustomers: ['Tech enthusiasts']
    }
  }

  const responses = { ...defaultResponses, ...customResponses }
  let callCount = 0

  return {
    chat: {
      completions: {
        create: jest.fn(() => {
          const responseKeys = Object.keys(responses)
          const key = responseKeys[callCount % responseKeys.length]
          callCount++
          
          const content = typeof responses[key] === 'string' 
            ? responses[key] 
            : JSON.stringify(responses[key])
            
          return Promise.resolve({
            choices: [{ message: { content } }]
          })
        })
      }
    }
  }
}

export const waitForAsync = (ms = 0) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const expectProductStructure = (product, type = 'ecommerce') => {
  expect(product).toHaveProperty('id')
  expect(product).toHaveProperty('name')
  expect(product).toHaveProperty('price')
  expect(product).toHaveProperty('description')
  
  if (type === 'ecommerce') {
    expect(product).toHaveProperty('inStock')
    expect(product).toHaveProperty('stock')
    expect(product).toHaveProperty('category')
    expect(typeof product.inStock).toBe('boolean')
    expect(typeof product.stock).toBe('number')
  } else {
    expect(product).toHaveProperty('deliveryTime')
    expect(product).toHaveProperty('features')
    expect(Array.isArray(product.features)).toBe(true)
  }
}

export const expectBusinessDataStructure = (businessData, type = 'ecommerce') => {
  expect(businessData).toHaveProperty('businessName')
  expect(businessData).toHaveProperty('businessModel')
  expect(businessData).toHaveProperty('products')
  expect(businessData).toHaveProperty('ecommerceSettings')
  expect(businessData).toHaveProperty('theme')
  
  expect(businessData.businessModel.isEcommerce).toBe(type === 'ecommerce')
  expect(Array.isArray(businessData.products)).toBe(true)
  
  if (type === 'ecommerce') {
    expect(businessData.ecommerceSettings.enabled).toBe(true)
    expect(businessData.ecommerceSettings).toHaveProperty('shipping')
    expect(businessData.ecommerceSettings).toHaveProperty('tax')
  } else {
    expect(businessData.ecommerceSettings.enabled).toBe(false)
  }
}

export const mockStripeCheckout = {
  sessions: {
    create: jest.fn(() => Promise.resolve({
      id: 'cs_test_session_id',
      url: 'https://checkout.stripe.com/pay/cs_test_session_id'
    }))
  }
}

export const mockFetch = (responses = {}) => {
  const defaultResponses = {
    '/api/stripe/checkout': {
      ok: true,
      json: () => Promise.resolve({
        url: 'https://checkout.stripe.com/test',
        sessionId: 'cs_test_123'
      })
    }
  }

  return jest.fn((url, options) => {
    const response = responses[url] || defaultResponses[url] || defaultResponses['/api/stripe/checkout']
    return Promise.resolve(response)
  })
}
