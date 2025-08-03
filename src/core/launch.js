/**
 * launch.js - Create the business
 * 
 * This module focuses on taking a validated opportunity and turning it into a functional business.
 * Following the future-proof approach, this layer uses whatever AI tools are best at the moment.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2 // Retry failed requests up to 2 times
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Wrapper for OpenAI calls with timeout and error handling
 */
async function callOpenAIWithTimeout(apiCall, timeoutMs = 30000) {
  return Promise.race([
    apiCall(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI API call timed out')), timeoutMs)
    )
  ]);
}

/**
 * Launches a business based on the analyzed opportunity
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @param {string} sessionId - Current session ID
 * @param {string} businessId - Business record ID
 * @returns {Object} Complete business data
 */
/**
 * Updates business data progressively during generation
 * @param {string} businessId - Business record ID
 * @param {Object} partialData - Partial business data to update
 * @param {string} stage - Optional stage update
 */
async function updateBusinessProgress(businessId, partialData, stage = null) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000'}/api/business/update-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId,
        partialData,
        stage
      })
    });
    
    if (!response.ok) {
      console.error('Failed to update business progress:', await response.text());
    }
  } catch (error) {
    console.error('Error updating business progress:', error);
    // Don't throw - this is just for UI updates, shouldn't break the main flow
  }
}

export async function launchBusiness(opportunity, sessionId, businessId) {
  console.log('Starting launch business - setting stage to building');
  // Update session to show we're building
  await supabase
    .from('sessions')
    .update({
      stage: 'building',
      progress: 60
    })
    .eq('id', sessionId);
  
  try {
    // Initialize partial business data with basic info
    let businessData = {
      businessName: opportunity.businessName,
      tagline: opportunity.solution,
      domain: generateDomain(opportunity.businessName),
      monthlyRevenue: opportunity.profitPotential,
    };
    
    // Update database with initial data so UI can show business name immediately
    console.log('Updating with initial business data...');
    await updateBusinessProgress(businessId, businessData, 'generating');
    
    // Generate logo (fast operation)
    console.log('Generating logo...');
    const logo = await generateLogo(opportunity.niche);
    console.log('Logo generated:', logo);
    businessData.logo = logo;
    
    // Update database with logo
    await updateBusinessProgress(businessId, { logo });
    
    // Generate website theme (can be slow)
    console.log('Generating website data...');
    const websiteData = await generateWebsite(opportunity);
    businessData.theme = websiteData.theme;
    businessData.layout = websiteData.layout;
    
    // Update database with theme/colors
    await updateBusinessProgress(businessId, { 
      theme: websiteData.theme, 
      layout: websiteData.layout 
    });
    
    // Create digital products (can be slow)
    console.log('Creating products...');
    const products = await createProducts(opportunity);
    businessData.products = products;
    
    // Determine and store business model for frontend adaptation (AI-powered)
    const businessModel = await determineBusinessModel(opportunity);
    businessData.businessModel = businessModel;
    console.log('Business model:', businessModel.isEcommerce ? 'E-commerce' : 'Service-based');
    console.log('AI confidence:', businessModel.confidence);
    console.log('Reasoning:', businessModel.reasoning);
    
    // Add e-commerce settings for cart functionality (always include for flexibility)
    businessData.ecommerceSettings = {
      enabled: businessModel.isEcommerce, // Controls whether cart functionality is active
      shipping: {
        standard: { name: 'Standard Shipping', price: 5.99, estimatedDays: '5-7' },
        express: { name: 'Express Shipping', price: 12.99, estimatedDays: '2-3' },
        overnight: { name: 'Overnight Shipping', price: 24.99, estimatedDays: '1' }
      },
      tax: {
        rate: 0.08, // 8% default tax rate
        includedInPrice: false
      },
      currency: 'USD',
      policies: {
        returns: businessModel.isEcommerce ? '30-day return policy' : '100% satisfaction guarantee',
        privacy: 'We protect your privacy and never share your data.',
        terms: 'Standard terms and conditions apply.'
      }
    };
    
    // Update database with products, business model, and e-commerce settings
    await updateBusinessProgress(businessId, { 
      products, 
      businessModel,
      ecommerceSettings: businessData.ecommerceSettings 
    });
    
    // Generate marketing materials and strategies (can be slow)
    console.log('Creating marketing materials...');
    const marketing = await createMarketing(opportunity);
    businessData.marketing = marketing;
    
    // Generate remaining data
    console.log('Identifying target customers...');
    const targetCustomers = await identifyTargetCustomers(opportunity);
    console.log('Target customers identified:', targetCustomers?.length || 0);
    
    console.log('Generating projected growth...');
    const monthlyData = generateProjectedGrowth();
    console.log('Projected growth generated:', monthlyData?.length || 0);
    
    // Complete business data
    businessData.targetCustomers = targetCustomers;
    businessData.monthlyData = monthlyData;
    
    console.log('Business data object created successfully');
    
    console.log('Setting stage to finalizing');
    // Update session to finalizing
    await supabase
      .from('sessions')
      .update({
        stage: 'finalizing',
        progress: 80
      })
      .eq('id', sessionId);
    
    // Final update with all data
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain.replace('.com', '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);
    
    console.log('Setting stage to complete');
    // Mark session as complete
    await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId);
    
    return businessData;
  } catch (error) {
    console.error("Error launching business:", error);
    await handleLaunchError(sessionId, businessId);
    throw error;
  }
}

/**
 * Generates a website theme and layout based on the opportunity
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {Object} Website theme and layout
 */
async function generateWebsite(opportunity) {
  try {
    console.log('Starting website generation for:', opportunity.businessName);
    const prompt = `
      Create a professional website theme and layout for this business:
      ${JSON.stringify(opportunity)}
      
      IMPORTANT: For Hero backgrounds, generate stunning visual elements:
      - Use high-quality Unsplash images that match the business type perfectly
      - Create complementary gradient overlays for text readability  
      - Ensure the background enhances the business brand and message
      - Use professional, modern imagery that appeals to the target audience
      
      For different business types, use these Unsplash image suggestions:
      - Fitness/Health: https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      - Business/Consulting: https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      - Technology: https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      - Creative/Design: https://images.unsplash.com/photo-1561736778-92e52a7769ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      - Education: https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      - Food/Restaurant: https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      - Real Estate: https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      - Finance: https://images.unsplash.com/photo-1559526324-4b87b5e36e44?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80
      
      Choose the most appropriate image URL based on the business type and niche.
      
      IMPORTANT: Create realistic, specific testimonials based on the business type. Each testimonial should:
      - Reference actual results or benefits someone would get from this business
      - Use appropriate names and roles for the target audience
      - Include specific details that make them believable
      - Show clear value provided by the business
      
      IMPORTANT: For pricing plans, ensure each plan has:
      - Realistic pricing for the business type
      - Clear feature differentiation
      - Appropriate call-to-action text (ctaText) like "Get Started", "Start Free Trial", "Contact Sales"
      - Mark the middle plan as popular (popular: true)
      
      Return a JSON object with:
      {
        "theme": {
          "colors": {
            "primary": "#hexcode (choose colors that complement the hero background image)",
            "secondary": "#hexcode (complementary color)",
            "textDark": "#1f2937",
            "textGray": "#6b7280",
            "borderColor": "#e5e7eb"
          },
          "font": "Inter, Poppins, or Montserrat - choose based on business type",
          "gradient": "CSS gradient that works harmoniously with the hero background",
          "heroGradient": "Specific gradient overlay for hero background for optimal text readability"
        },
        "layout": [
          {
            "component": "NavBar",
            "props": {
              "businessName": "Name",
              "logo": "Emoji",
              "links": ["About", "Services", "Pricing", "Contact"],
              "ctaText": "Get Started"
            }
          },
          {
            "component": "Hero",
            "props": {
              "title": "Hero title based on business",
              "subtitle": "Compelling subtitle",
              "ctaText": "Get Started",
              "ctaLink": "#contact",
              "backgroundImage": "High-quality background image URL that matches the business type (choose from the Unsplash URLs above)",
              "backgroundOverlay": "Use the heroGradient from theme for optimal text readability"
            }
          },
          {
            "component": "FeatureGrid", 
            "props": {
              "title": "Why Choose Us",
              "features": [
                {
                  "icon": "⚡",
                  "title": "Feature 1",
                  "description": "Feature description"
                }
              ]
            }
          },
          {
            "component": "TestimonialSlider",
            "props": {
              "title": "What Our Clients Say",
              "testimonials": [
                {
                  "name": "First Name + Last Name",
                  "role": "Job Title relevant to target customer",
                  "content": "Specific testimonial about results achieved with this business - include numbers, timeframes, or specific benefits. Make it realistic and believable for this business type.",
                  "avatar": "👨‍💼 or 👩‍💼 or similar professional emoji",
                  "rating": 5
                },
                {
                  "name": "Different Name",
                  "role": "Different relevant job title", 
                  "content": "Another specific testimonial highlighting different benefits of this business. Include specific details that show real value.",
                  "avatar": "👩‍� or 👨‍🚀 or other professional emoji",
                  "rating": 5
                },
                {
                  "name": "Third Name",
                  "role": "Third relevant role",
                  "content": "Third testimonial focusing on another key benefit or outcome customers get from this business.",
                  "avatar": "Different professional emoji", 
                  "rating": 5
                }
              ]
            }
          },
          {
            "component": "PricingTable",
            "props": {
              "title": "Choose Your Plan",
              "subtitle": "Flexible pricing for every need",
              "plans": [
                {
                  "name": "Basic Plan Name",
                  "price": "$XX",
                  "period": "month",
                  "description": "Brief description of what this plan offers",
                  "features": [
                    "Feature 1 relevant to business",
                    "Feature 2 relevant to business", 
                    "Feature 3 relevant to business"
                  ],
                  "ctaText": "Get Started",
                  "popular": false
                },
                {
                  "name": "Premium Plan Name",
                  "price": "$XX", 
                  "period": "month",
                  "description": "Most popular choice with additional features",
                  "features": [
                    "All Basic features",
                    "Premium feature 1",
                    "Premium feature 2",
                    "Premium feature 3"
                  ],
                  "ctaText": "Start Free Trial",
                  "popular": true
                },
                {
                  "name": "Enterprise Plan Name",
                  "price": "$XX",
                  "period": "month",
                  "description": "For serious businesses",
                  "features": [
                    "All Premium features",
                    "Enterprise feature 1",
                    "Enterprise feature 2"
                  ],
                  "ctaText": "Contact Sales", 
                  "popular": false
                }
              ]
            }
          },
          {
            "component": "CallToAction",
            "props": {
              "title": "Ready to Get Started?",
              "ctaText": "Start Now"
            }
          },
          {
            "component": "Footer",
            "props": {
              "businessName": "Use business name"
            }
          }
        ]
      }
    `;

    console.log('Calling OpenAI for website generation...');
    const response = await callOpenAIWithTimeout(() => 
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert web designer that creates modern, professional website themes and layouts." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    console.log('OpenAI response received for website generation');
    const result = JSON.parse(response.choices[0].message.content);
    
    // Enhance result with business-specific visuals if not provided
    const visuals = getBusinessVisuals(opportunity.niche, opportunity.businessType);
    if (result.layout) {
      const heroComponent = result.layout.find(component => component.component === 'Hero');
      if (heroComponent && !heroComponent.props.backgroundImage) {
        heroComponent.props.backgroundImage = visuals.background;
        heroComponent.props.backgroundOverlay = visuals.overlay;
      }
    }
    
    console.log('Website generation completed successfully');
    return result;
  } catch (error) {
    console.error("Error generating website:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    
    // Provide fallback website data with enhanced visuals
    const visuals = getBusinessVisuals(opportunity.niche, opportunity.businessType);
    return {
      theme: {
        colors: {
          primary: "#3b82f6",
          secondary: "#1e40af",
          textDark: "#1f2937",
          textGray: "#6b7280",
          borderColor: "#e5e7eb"
        },
        font: "Inter",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        heroGradient: visuals.overlay
      },
      layout: generateDefaultLayout(opportunity, visuals)
    };
  }
}

/**
 * Generates products based on the business opportunity
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {Array} List of product offerings
 */
async function createProducts(opportunity) {
  try {
    console.log('Starting product creation for:', opportunity.businessName);
    
    // Determine if this should be an e-commerce business or service business (AI-powered)
    const businessModel = await determineBusinessModel(opportunity);
    console.log('Business model determined:', businessModel.isEcommerce ? 'E-commerce' : 'Service-based');
    console.log('AI reasoning:', businessModel.reasoning);
    
    const prompt = `
      Create ${businessModel.isEcommerce ? 'between 8-20' : '3-5'} compelling ${businessModel.isEcommerce ? 'physical/digital products' : 'service offerings'} for this business opportunity:
      
      Business Name: ${opportunity.businessName || 'Not specified'}
      Niche: ${opportunity.niche || 'Not specified'}
      Solution: ${opportunity.solution || 'Not specified'}
      Problem Being Solved: ${opportunity.problem || 'Not specified'}
      Target Market: ${opportunity.targetMarket || 'Not specified'}
      
      Business Model Detected: ${businessModel.isEcommerce ? 'E-COMMERCE (selling products)' : 'SERVICE-BASED (providing services)'}
      AI Confidence: ${businessModel.confidence || 0.8}
      Categories: ${businessModel.productCategories?.join(', ') || 'General'}
      
      ${businessModel.isEcommerce ? `
      This is an E-COMMERCE business. Create a diverse product catalog with these characteristics:
      
      PRODUCT REQUIREMENTS:
      - Product categories: ${businessModel.productCategories.join(', ')}
      - Mix of price points: budget ($15-50), mid-range ($50-150), premium ($150+)
      - Include seasonal/trending items where relevant
      - Add realistic stock levels and availability
      - Use high-quality product images from Unsplash
      - Include detailed specifications and features
      - Add sale items (20-30% of products should be on sale)
      
      PRODUCT STRUCTURE (each product needs):
      - id: unique identifier (e.g., "prod-001")
      - name: Clear, appealing product name
      - price: Current price (number, not string)
      - originalPrice: Higher price if on sale (number, optional)
      - description: Detailed product description (2-3 sentences)
      - image: Relevant Unsplash image URL
      - category: One of the provided categories
      - inStock: true/false
      - stock: Number of items available (0-100)
      - features: Array of 3-5 key product features
      - specifications: Object with technical details
      - isOnSale: true if originalPrice exists
      
      Focus on products that would realistically sell in this niche and appeal to the target market.
      ` : `
      This is a SERVICE business. Create professional service packages with these characteristics:
      
      SERVICE REQUIREMENTS:
      - Different tiers: Basic, Professional, Premium/Enterprise
      - Clear value propositions for each tier
      - Realistic pricing for the target market and niche
      - Specific deliverables and timelines
      - Progressive feature sets (basic → premium)
      
      SERVICE STRUCTURE (each service needs):
      - id: unique identifier (e.g., "svc-001") 
      - name: Professional service package name
      - price: Price as number (not string with $)
      - description: What's included in this service (2-3 sentences)
      - deliveryTime: Realistic completion timeframe
      - features: Array of 4-6 specific deliverables/benefits
      - category: Type of service offered
      - popular: true for the middle tier (most popular)
      
      Focus on services that solve the identified problem and deliver clear value to the target market.
      `}
      
      IMPORTANT: Base all products/services on the actual business opportunity provided. Make them realistic, specific to the niche, and appealing to the target market.
      
      Return as a JSON object with:
      {
        "businessModel": "${businessModel.isEcommerce ? 'ecommerce' : 'service'}",
        "totalItems": ${businessModel.isEcommerce ? '12-18' : '3-4'},
        "products": [/* array of products/services following the structure above */]
      }
    `;

    console.log('Calling OpenAI for product creation...');
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a product development and pricing expert who understands the difference between e-commerce and service businesses." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    console.log('OpenAI response received for product creation');
    const result = JSON.parse(response.choices[0].message.content);
    const products = result.products || [];
    
    console.log(`Products created successfully: ${products.length} ${businessModel.isEcommerce ? 'products' : 'services'} for ${businessModel.isEcommerce ? 'e-commerce' : 'service'} business`);
    return products;
  } catch (error) {
    console.error("Error creating products:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type
    });
    
    // Determine fallback based on business type
    const businessModel = await determineBusinessModel(opportunity);
    
    if (businessModel.isEcommerce) {
      // Fallback e-commerce products
      return [
        { id: "prod-1", name: "Starter Package", price: 49.99, description: "Essential product to get you started", image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Starter", inStock: true, stock: 25, features: ["Feature 1", "Feature 2"], specifications: {}, isOnSale: false },
        { id: "prod-2", name: "Professional Kit", price: 99.99, originalPrice: 129.99, description: "Complete professional solution", image: "https://images.unsplash.com/photo-1556742049-0cfed14d4617?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Professional", inStock: true, stock: 15, features: ["All Starter features", "Premium feature"], specifications: {}, isOnSale: true },
        { id: "prod-3", name: "Premium Bundle", price: 199.99, description: "Everything you need for success", image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Premium", inStock: true, stock: 10, features: ["All Professional features", "Exclusive content"], specifications: {}, isOnSale: false },
        { id: "prod-4", name: "Deluxe Edition", price: 149.99, description: "Enhanced version with extra benefits", image: "https://images.unsplash.com/photo-1542393545-10f5cde2c810?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Deluxe", inStock: true, stock: 8, features: ["Deluxe features"], specifications: {}, isOnSale: false },
        { id: "prod-5", name: "Basic Model", price: 29.99, description: "Affordable option for beginners", image: "https://images.unsplash.com/photo-1527385352018-3c26dd6c3916?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Basic", inStock: true, stock: 50, features: ["Basic features"], specifications: {}, isOnSale: false },
        { id: "prod-6", name: "Advanced Pro", price: 299.99, description: "For advanced users who need more", image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Advanced", inStock: true, stock: 5, features: ["Advanced features"], specifications: {}, isOnSale: false },
        { id: "prod-7", name: "Ultimate Package", price: 499.99, description: "The complete solution for professionals", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Ultimate", inStock: true, stock: 3, features: ["All features included"], specifications: {}, isOnSale: false },
        { id: "prod-8", name: "Compact Version", price: 79.99, description: "Space-saving design with full functionality", image: "https://images.unsplash.com/photo-1586953983027-d7508698d47b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80", category: "Compact", inStock: true, stock: 20, features: ["Compact design"], specifications: {}, isOnSale: false }
      ];
    } else {
      // Fallback service packages
      return [
        { id: "svc-1", name: "Basic Package", price: 97, description: "Essential services to get you started", deliveryTime: "3-5 business days", features: ["Core service", "Email support"], category: "Basic", popular: false },
        { id: "svc-2", name: "Professional Package", price: 297, description: "Comprehensive solutions for established businesses", deliveryTime: "5-7 business days", features: ["All Basic features", "Priority support", "Advanced features"], category: "Professional", popular: true },
        { id: "svc-3", name: "Premium Package", price: 597, description: "All-inclusive enterprise-grade services", deliveryTime: "7-10 business days", features: ["All Professional features", "Dedicated account manager", "Custom solutions"], category: "Premium", popular: false }
      ];
    }
  }
}

/**
 * Determines if a business should be e-commerce or service-based using AI
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {Object} Business model information
 */
async function determineBusinessModel(opportunity) {
  try {
    console.log('Using AI to determine business model for:', opportunity.businessName);
    
    const prompt = `
      Analyze this business opportunity and determine if it should be an E-COMMERCE business (selling physical/digital products) or a SERVICE business (providing services/consulting):
      
      Business Name: ${opportunity.businessName || 'Not specified'}
      Niche: ${opportunity.niche || 'Not specified'}
      Solution: ${opportunity.solution || 'Not specified'}
      Problem: ${opportunity.problem || 'Not specified'}
      Target Market: ${opportunity.targetMarket || 'Not specified'}
      
      Consider these factors:
      - Does this business naturally sell physical or digital products?
      - Would customers expect to "buy items" or "hire services"?
      - Is this more about tangible goods or expertise/time?
      - What would be the primary revenue model?
      
      E-COMMERCE examples: clothing store, electronics shop, book publisher, supplement brand, jewelry maker, toy store, home decor, beauty products
      SERVICE examples: consulting, coaching, marketing agency, web design, accounting, legal services, photography, event planning, cleaning, tutoring
      
      Return a JSON object with:
      {
        "businessModel": "ecommerce" or "service",
        "confidence": 0.85, // 0-1 confidence score
        "reasoning": "Brief explanation of why this classification was chosen",
        "productCategories": ["Category1", "Category2"] // Only if ecommerce, empty array if service
      }
    `;

    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a business model analyst expert at determining whether businesses should be e-commerce or service-based." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    const result = JSON.parse(response.choices[0].message.content);
    const isEcommerce = result.businessModel === 'ecommerce';
    
    console.log(`AI determined business model: ${result.businessModel} (confidence: ${result.confidence})`);
    console.log(`Reasoning: ${result.reasoning}`);
    
    return {
      isEcommerce,
      productCategories: result.productCategories || [],
      confidence: result.confidence || 0.8,
      reasoning: result.reasoning || 'AI classification based on business characteristics'
    };
    
  } catch (error) {
    console.error("Error determining business model with AI:", error);
    console.log("Falling back to keyword-based detection");
    
    // Fallback to enhanced keyword-based detection
    return determineBusinessModelFallback(opportunity);
  }
}

/**
 * Fallback keyword-based business model determination
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {Object} Business model information
 */
function determineBusinessModelFallback(opportunity) {
  const niche = (opportunity.niche || '').toLowerCase();
  const solution = (opportunity.solution || '').toLowerCase();
  const problem = (opportunity.problem || '').toLowerCase();
  const businessName = (opportunity.businessName || '').toLowerCase();
  
  // E-commerce indicators (expanded and more specific)
  const ecommerceKeywords = [
    // Direct product terms
    'store', 'shop', 'retail', 'sell', 'product', 'goods', 'merchandise', 'inventory', 'catalog',
    // Product categories
    'fashion', 'clothing', 'apparel', 'jewelry', 'accessories', 'shoes', 'bags',
    'electronics', 'gadgets', 'devices', 'computers', 'phones', 'tech',
    'home', 'furniture', 'decor', 'kitchen', 'appliances', 'tools', 'equipment',
    'beauty', 'cosmetics', 'skincare', 'makeup', 'fragrance', 'personal care',
    'health products', 'supplements', 'vitamins', 'wellness products',
    'books', 'publishing', 'ebooks', 'courses', 'digital downloads',
    'toys', 'games', 'sports equipment', 'fitness gear', 'outdoor gear',
    'food', 'beverage', 'snacks', 'organic', 'gourmet',
    'automotive', 'car parts', 'motorcycle', 'vehicle accessories',
    'pet supplies', 'baby products', 'kids items', 'maternity',
    'art supplies', 'crafts', 'hobbies', 'collectibles',
    // Business model terms
    'marketplace', 'e-commerce', 'online store', 'dropshipping', 'wholesale', 'brand'
  ];
  
  // Service indicators (expanded and more specific)
  const serviceKeywords = [
    // Direct service terms
    'service', 'services', 'consulting', 'consultant', 'agency', 'firm',
    'coaching', 'training', 'education', 'teaching', 'tutoring', 'mentoring',
    // Professional services
    'marketing', 'advertising', 'seo', 'social media', 'content creation',
    'design', 'web design', 'graphic design', 'branding', 'creative',
    'development', 'software', 'app development', 'programming', 'tech solutions',
    'legal', 'law', 'attorney', 'lawyer', 'paralegal',
    'accounting', 'bookkeeping', 'tax', 'financial planning', 'cpa',
    'healthcare', 'medical', 'therapy', 'counseling', 'wellness',
    'fitness training', 'personal training', 'nutrition', 'lifestyle',
    'photography', 'videography', 'media production', 'editing',
    'event planning', 'wedding planning', 'party planning', 'catering',
    'cleaning', 'maintenance', 'repair', 'installation', 'handyman',
    'landscaping', 'gardening', 'lawn care', 'exterior',
    'real estate', 'property management', 'brokerage',
    'translation', 'writing', 'copywriting', 'editing', 'proofreading',
    'research', 'analysis', 'strategy', 'planning', 'optimization',
    // Service delivery terms
    'freelance', 'professional', 'expert', 'specialist', 'advisor'
  ];
  
  const textToCheck = `${niche} ${solution} ${problem} ${businessName}`;
  
  const ecommerceMatches = ecommerceKeywords.filter(keyword => 
    textToCheck.includes(keyword)
  );
  
  const serviceMatches = serviceKeywords.filter(keyword => 
    textToCheck.includes(keyword)
  );
  
  const isEcommerce = ecommerceMatches.length > serviceMatches.length;
  
  // Generate categories based on detected keywords and niche
  let productCategories = [];
  if (isEcommerce) {
    if (textToCheck.includes('fashion') || textToCheck.includes('clothing') || textToCheck.includes('apparel')) {
      productCategories = ['Tops', 'Bottoms', 'Dresses', 'Accessories', 'Shoes'];
    } else if (textToCheck.includes('tech') || textToCheck.includes('electronics') || textToCheck.includes('gadgets')) {
      productCategories = ['Smartphones', 'Laptops', 'Accessories', 'Gadgets', 'Components'];
    } else if (textToCheck.includes('home') || textToCheck.includes('furniture') || textToCheck.includes('decor')) {
      productCategories = ['Furniture', 'Lighting', 'Decor', 'Storage', 'Kitchen'];
    } else if (textToCheck.includes('health') || textToCheck.includes('fitness') || textToCheck.includes('wellness')) {
      productCategories = ['Supplements', 'Equipment', 'Apparel', 'Accessories', 'Recovery'];
    } else if (textToCheck.includes('beauty') || textToCheck.includes('cosmetics') || textToCheck.includes('skincare')) {
      productCategories = ['Skincare', 'Makeup', 'Haircare', 'Fragrance', 'Tools'];
    } else if (textToCheck.includes('book') || textToCheck.includes('education') || textToCheck.includes('course')) {
      productCategories = ['Books', 'Courses', 'Guides', 'Resources', 'Templates'];
    } else {
      productCategories = ['Featured', 'Popular', 'New Arrivals', 'Best Sellers', 'Clearance'];
    }
  }
  
  const confidence = Math.max(ecommerceMatches.length, serviceMatches.length) / Math.max(ecommerceKeywords.length * 0.1, 1);
  
  return {
    isEcommerce,
    productCategories,
    confidence: Math.min(confidence, 0.95),
    reasoning: isEcommerce ? 
      `E-commerce classification: Found ${ecommerceMatches.length} product indicators (${ecommerceMatches.slice(0, 3).join(', ')}) vs ${serviceMatches.length} service indicators` :
      `Service classification: Found ${serviceMatches.length} service indicators (${serviceMatches.slice(0, 3).join(', ')}) vs ${ecommerceMatches.length} product indicators`
  };
}

/**
 * Creates marketing strategies and materials
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {Object} Marketing strategies and content
 */
async function createMarketing(opportunity) {
  try {
    console.log('Starting marketing creation for:', opportunity.businessName);
    const prompt = `
      Create a complete marketing strategy for this business:
      ${JSON.stringify(opportunity)}
      
      Include:
      - 3 customer acquisition channels
      - 5 content marketing topics
      - 3 initial social media post ideas
      - A short elevator pitch
      - 3 key selling points
      
      Return as a structured JSON object.
    `;

    console.log('Calling OpenAI for marketing creation...');
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a marketing expert specializing in growth strategies for new businesses." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    console.log('OpenAI response received for marketing creation');
    const result = JSON.parse(response.choices[0].message.content);
    console.log('Marketing creation completed successfully');
    return result;
  } catch (error) {
    console.error("Error creating marketing:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type
    });
    
    // Fallback marketing plan
    return {
      acquisitionChannels: [
        "Direct outreach to potential clients",
        "Content marketing and SEO",
        "Strategic partnerships with complementary businesses"
      ],
      contentTopics: [
        "Industry trends and insights",
        "Client success stories",
        "How-to guides and tutorials",
        "Comparison guides",
        "Expert interviews"
      ],
      socialMediaPosts: [
        "Introducing our services to help you [solve main problem]",
        "The top 3 challenges our clients face and how we solve them",
        "Special launch offer: Get started today and receive [incentive]"
      ],
      elevatorPitch: `We help ${opportunity.niche} solve ${opportunity.problem} through our unique ${opportunity.solution}.`,
      sellingPoints: [
        "Expert solutions tailored to your specific needs",
        "Proven results with measurable outcomes",
        "Ongoing support to ensure your success"
      ]
    };
  }
}

/**
 * Generates a domain name based on business name
 * 
 * @param {string} businessName - Name of the business
 * @returns {string} Domain name suggestion
 */
function generateDomain(businessName) {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15) + '.com';
}

/**
 * Gets business-specific background images and overlays
 */
function getBusinessVisuals(niche, businessType) {
  const visualMap = {
    fitness: {
      background: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(245, 87, 108, 0.8) 0%, rgba(240, 147, 251, 0.6) 100%)"
    },
    health: {
      background: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(67, 233, 123, 0.8) 0%, rgba(56, 249, 215, 0.6) 100%)"
    },
    business: {
      background: "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(79, 172, 254, 0.8) 0%, rgba(0, 242, 254, 0.6) 100%)"
    },
    technology: {
      background: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.6) 100%)"
    },
    creative: {
      background: "https://images.unsplash.com/photo-1561736778-92e52a7769ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(250, 112, 154, 0.8) 0%, rgba(254, 225, 64, 0.6) 100%)"
    },
    education: {
      background: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(168, 237, 234, 0.8) 0%, rgba(254, 214, 227, 0.6) 100%)"
    },
    food: {
      background: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(255, 236, 210, 0.8) 0%, rgba(252, 182, 159, 0.6) 100%)"
    },
    finance: {
      background: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(26, 43, 72, 0.8) 0%, rgba(59, 130, 246, 0.6) 100%)"
    },
    realestate: {
      background: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(34, 197, 94, 0.8) 0%, rgba(59, 130, 246, 0.6) 100%)"
    },
    consulting: {
      background: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(147, 51, 234, 0.6) 100%)"
    },
    default: {
      background: "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(79, 172, 254, 0.8) 0%, rgba(0, 242, 254, 0.6) 100%)"
    }
  };
  
  const lowerNiche = niche?.toLowerCase() || '';
  const lowerType = businessType?.toLowerCase() || '';
  
  // Check niche first, then business type
  for (const [key, visuals] of Object.entries(visualMap)) {
    if (lowerNiche.includes(key) || lowerType.includes(key)) {
      return visuals;
    }
  }
  
  return visualMap.default;
}

/**
 * Generates a logo (emoji) for the business
 * 
 * @param {string} niche - Business niche
 * @returns {string} Emoji representing the business
 */
async function generateLogo(niche) {
  try {
    console.log('Starting logo generation for niche:', niche);
    const prompt = `Choose a single emoji that best represents a business in the "${niche}" niche. Return just the emoji character.`;

    console.log('Calling OpenAI for logo generation...');
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: prompt }
        ]
      })
    );
    
    console.log('OpenAI response received for logo generation');
    const emoji = response.choices[0].message.content.trim();
    const finalEmoji = emoji.length > 2 ? '🚀' : emoji;
    console.log('Logo generated successfully:', finalEmoji);
    return finalEmoji;
  } catch (error) {
    console.error("Error generating logo:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type
    });
    return '🚀';
  }
}

/**
 * Identifies target customers for the business
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {Array} List of target customer descriptions
 */
async function identifyTargetCustomers(opportunity) {
  try {
    console.log('Starting target customer identification for:', opportunity.businessName);
    const prompt = `
      Based on this business opportunity:
      ${JSON.stringify(opportunity)}
      
      Identify 3 specific target customer segments that would benefit most from this business.
      Be specific about demographics, pain points, and motivations.
      
      Return as a JSON object with a "targetCustomers" array containing strings.
      Example format:
      {
        "targetCustomers": [
          "Customer segment 1 description",
          "Customer segment 2 description", 
          "Customer segment 3 description"
        ]
      }
    `;

    console.log('Calling OpenAI for target customer identification...');
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a customer research specialist." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    console.log('OpenAI response received for target customer identification');
    const { targetCustomers } = JSON.parse(response.choices[0].message.content);
    console.log('Target customers identified successfully:', targetCustomers?.length || 0);
    return targetCustomers || [];
  } catch (error) {
    console.error("Error identifying target customers:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type
    });
    return [
      "Small business owners looking to grow their online presence",
      "Professionals seeking to establish industry authority",
      "Organizations needing specialized expertise in this field"
    ];
  }
}

/**
 * Generates projected monthly growth data
 * 
 * @returns {Array} 6 months of projected growth data
 */
function generateProjectedGrowth() {
  const baseRevenue = 500;
  const growthRate = 1.7;
  
  return Array(6).fill().map((_, i) => ({
    month: `Month ${i + 1}`,
    revenue: Math.round(baseRevenue * Math.pow(growthRate, i))
  }));
}

/**
 * Handles errors during the launch process
 * 
 * @param {string} sessionId - Current session ID
 * @param {string} businessId - Business record ID
 */
async function handleLaunchError(sessionId, businessId) {
  // Update session to error state
  await supabase
    .from('sessions')
    .update({ stage: 'error' })
    .eq('id', sessionId);
  
  // Update business status
  await supabase
    .from('businesses')
    .update({ status: 'failed' })
    .eq('id', businessId);
}

/**
 * Generates a default layout when AI fails
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @param {Object} visuals - Business-specific visual assets
 * @returns {Array} Default layout configuration
 */
function generateDefaultLayout(opportunity, visuals = null) {
  const businessVisuals = visuals || getBusinessVisuals(opportunity.niche, opportunity.businessType);
  
  return [
    {
      component: 'NavBar',
      props: {
        businessName: opportunity.businessName || 'Your Business',
        logo: '🚀',
        links: ['About', 'Services', 'Pricing', 'Contact'],
        ctaText: 'Get Started'
      }
    },
    {
      component: 'Hero',
      props: {
        title: opportunity.solution || 'Transform Your Business',
        subtitle: opportunity.problem || 'Professional solutions tailored to your needs',
        ctaText: 'Get Started Today',
        backgroundImage: businessVisuals.background,
        backgroundOverlay: businessVisuals.overlay
      }
    },
    {
      component: 'FeatureGrid',
      props: {
        title: 'Why Choose Us',
        features: [
          {
            icon: '⚡',
            title: 'Fast & Reliable',
            description: 'Quick turnaround times with consistent quality results'
          },
          {
            icon: '🎯',
            title: 'Targeted Solutions',
            description: 'Customized approaches designed for your specific needs'
          },
          {
            icon: '🚀',
            title: 'Growth Focused',
            description: 'Strategies that scale with your business success'
          }
        ]
      }
    },
    {
      component: 'PricingTable',
      props: {
        title: 'Our Packages',
        plans: [
          {
            name: 'Starter',
            price: '$99',
            period: 'month',
            description: 'Perfect for getting started',
            features: ['Everything you need to begin', 'Email support', '30-day guarantee'],
            ctaText: 'Get Started',
            popular: false
          },
          {
            name: 'Professional',
            price: '$299',
            period: 'month',
            description: 'Most popular choice',
            features: ['All Starter features', 'Priority support', 'Advanced features', 'Custom integrations'],
            ctaText: 'Start Free Trial',
            popular: true
          }
        ]
      }
    },
    {
      component: 'CallToAction',
      props: {
        title: 'Ready to Get Started?',
        subtitle: 'Join thousands of satisfied customers today',
        ctaText: 'Start Now'
      }
    },
    {
      component: 'Footer',
      props: {
        businessName: opportunity.businessName || 'Your Business',
        logo: '🚀',
        description: opportunity.solution || 'Professional solutions for your success'
      }
    }
  ];
}
