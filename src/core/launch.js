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
    
    // Add e-commerce settings based on business type
    console.log('Adding e-commerce settings...');
    const ecommerceSettings = generateEcommerceSettings(opportunity.businessType, products);
    businessData.ecommerceSettings = ecommerceSettings;
    
    // Update database with products and e-commerce settings
    await updateBusinessProgress(businessId, { products, ecommerceSettings });
    
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
    
    // Determine if this is an e-commerce business
    const isEcommerce = opportunity.businessType && (
      opportunity.businessType.toLowerCase().includes('ecommerce') ||
      opportunity.businessType.toLowerCase().includes('e-commerce') ||
      opportunity.businessType.toLowerCase().includes('retail') ||
      opportunity.businessType.toLowerCase().includes('store') ||
      opportunity.businessType.toLowerCase().includes('shop')
    );
    
    const basePrompt = `
      Create 3 compelling product or service offerings for this business:
      ${JSON.stringify(opportunity)}
      
      Each product should have:
      - A clear name
      - A compelling description
      - An appropriate price point for the target market
    `;
    
    const ecommercePrompt = `
      ${basePrompt}
      
      Since this is an e-commerce business, also include:
      - Stock quantity (realistic numbers between 10-100)
      - At least one variant option (like size, color, or model) for each product
      - Features list (3-5 key features per product)
      - Original price if there's a discount (optional)
      
      Return as JSON with this exact structure:
      {
        "products": [
          {
            "id": "product-slug",
            "name": "Product Name",
            "price": "$99.99",
            "originalPrice": "$129.99",
            "description": "Product description",
            "stock": 45,
            "image": null,
            "icon": "📦",
            "features": ["Feature 1", "Feature 2", "Feature 3"],
            "variants": [
              {"id": "variant-1", "name": "Small", "price": "$99.99"},
              {"id": "variant-2", "name": "Medium", "price": "$109.99"},
              {"id": "variant-3", "name": "Large", "price": "$119.99"}
            ],
            "variantType": "Size"
          }
        ]
      }
    `;
    
    const servicePrompt = `
      ${basePrompt}
      
      Since this is a service business, also include:
      - Features list (3-5 key features per service)
      - Service period if recurring (monthly, yearly, one-time)
      
      Return as JSON with this structure:
      {
        "products": [
          {
            "id": "service-slug",
            "name": "Service Name",
            "price": "$99",
            "period": "monthly",
            "description": "Service description",
            "icon": "🚀",
            "features": ["Feature 1", "Feature 2", "Feature 3"],
            "ctaText": "Get Started"
          }
        ]
      }
    `;

    console.log('Calling OpenAI for product creation...');
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a product development and pricing expert." },
          { role: "user", content: isEcommerce ? ecommercePrompt : servicePrompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    console.log('OpenAI response received for product creation');
    const { products } = JSON.parse(response.choices[0].message.content);
    
    // Enhance products with additional e-commerce data if needed
    const enhancedProducts = products.map((product, index) => {
      const enhanced = {
        ...product,
        id: product.id || product.name.toLowerCase().replace(/\s+/g, '-')
      };
      
      if (isEcommerce && !product.stock) {
        enhanced.stock = Math.floor(Math.random() * 90) + 10; // 10-100 stock
      }
      
      return enhanced;
    });
    
    console.log('Products created successfully:', enhancedProducts?.length || 0);
    return enhancedProducts || [];
  } catch (error) {
    console.error("Error creating products:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type
    });
    
    // Determine fallback type
    const isEcommerce = opportunity.businessType && (
      opportunity.businessType.toLowerCase().includes('ecommerce') ||
      opportunity.businessType.toLowerCase().includes('retail') ||
      opportunity.businessType.toLowerCase().includes('store')
    );
    
    // Fallback products
    if (isEcommerce) {
      return [
        { 
          id: "starter-product",
          name: "Starter Product", 
          price: "$29.99", 
          description: "Perfect for getting started",
          stock: 50,
          features: ["High quality", "Fast shipping", "1-year warranty"],
          variants: [
            { id: "small", name: "Small", price: "$29.99" },
            { id: "medium", name: "Medium", price: "$34.99" },
            { id: "large", name: "Large", price: "$39.99" }
          ],
          variantType: "Size",
          icon: "📦"
        },
        { 
          id: "premium-product",
          name: "Premium Product", 
          price: "$79.99",
          originalPrice: "$99.99", 
          description: "Our most popular choice",
          stock: 25,
          features: ["Premium quality", "Extended warranty", "Free shipping", "24/7 support"],
          variants: [
            { id: "basic", name: "Basic", price: "$79.99" },
            { id: "deluxe", name: "Deluxe", price: "$89.99" }
          ],
          variantType: "Model",
          icon: "⭐"
        },
        { 
          id: "enterprise-product",
          name: "Enterprise Product", 
          price: "$149.99", 
          description: "For serious customers",
          stock: 15,
          features: ["Enterprise grade", "Bulk pricing", "Dedicated support", "Custom options"],
          icon: "💎"
        }
      ];
    } else {
      return [
        { id: "basic-package", name: "Basic Package", price: "$97", period: "one-time", description: "Essential services to get you started", features: ["Basic setup", "Email support", "30-day guarantee"], icon: "🚀", ctaText: "Get Started" },
        { id: "professional-package", name: "Professional Package", price: "$297", period: "one-time", description: "Comprehensive solutions for established businesses", features: ["Advanced setup", "Priority support", "60-day guarantee", "Training included"], icon: "⭐", ctaText: "Go Pro" },
        { id: "premium-package", name: "Premium Package", price: "$597", period: "one-time", description: "All-inclusive enterprise-grade services", features: ["Full setup", "24/7 support", "90-day guarantee", "Custom development"], icon: "💎", ctaText: "Contact Sales" }
      ];
    }
  }
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

/**
 * Generate e-commerce settings based on business type and products
 */
function generateEcommerceSettings(businessType, products) {
  const isEcommerce = businessType && (
    businessType.toLowerCase().includes('ecommerce') ||
    businessType.toLowerCase().includes('e-commerce') ||
    businessType.toLowerCase().includes('retail') ||
    businessType.toLowerCase().includes('store') ||
    businessType.toLowerCase().includes('shop') ||
    (products && products.some(p => p.price && !p.period)) // Has products without recurring periods
  );

  if (!isEcommerce) {
    return null;
  }

  return {
    enabled: true,
    businessType: 'ecommerce', // Flag to determine site type
    shipping: {
      freeShippingThreshold: 50,
      standardRate: 5.99,
      expressRate: 12.99,
      estimatedDelivery: '5-7 business days',
      expeditedDelivery: '2-3 business days'
    },
    tax: {
      rate: 0.08, // Simple percentage (8%)
      included: false,
      description: 'Tax calculated at checkout'
    },
    policies: {
      returns: '30-day returns',
      shipping: 'Ships within 2 business days',
      warranty: '1-year warranty on all products',
      support: 'Email support within 24 hours'
    },
    currency: {
      code: 'USD',
      symbol: '$',
      decimal: 2
    },
    inventory: {
      trackStock: true,
      lowStockThreshold: 5,
      outOfStockBehavior: 'hide' // 'hide' or 'show'
    },
    checkout: {
      guestCheckout: true,
      requireAccount: false,
      savePaymentMethods: false
    },
    notifications: {
      orderConfirmation: true,
      shipmentTracking: true,
      lowStock: true
    }
  };
}
