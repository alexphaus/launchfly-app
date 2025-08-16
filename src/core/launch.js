// src/core/launch.js
/**
 * launch.js - Create the business
 * 
 * This module focuses on taking a validated opportunity and turning it into a functional business.
 * Following the future-proof approach, this layer uses whatever AI tools are best at the moment.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { getCuratedOffers } from '../offers/library';

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
    console.log(`Updating business progress for ${businessId}:`, Object.keys(partialData));
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000'}/api/business/update-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId,
        partialData,
        stage
      }),
      timeout: 10000 // 10 second timeout for the update call
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update business progress. Status:', response.status, 'Error:', errorText);
      
      // Try direct database update as fallback
      console.log('Attempting direct database update as fallback...');
      return await updateBusinessDirectly(businessId, partialData, stage);
    }
    
    const result = await response.json();
    console.log('Business progress updated successfully');
    return result;
    
  } catch (error) {
    console.error('Error updating business progress via API:', error);
    
    // Try direct database update as fallback
    console.log('Attempting direct database update as fallback...');
    try {
      return await updateBusinessDirectly(businessId, partialData, stage);
    } catch (fallbackError) {
      console.error('Fallback database update also failed:', fallbackError);
      // Don't throw - this is just for UI updates, shouldn't break the main flow
      return { success: false, error: fallbackError.message };
    }
  }
}

/**
 * Direct database update as fallback when API fails
 */
async function updateBusinessDirectly(businessId, partialData, stage = null) {
  try {
    // Get current business data
    const { data: currentBusiness, error: fetchError } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching current business data for direct update:', fetchError);
      throw fetchError;
    }
    
    // Merge the new partial data with existing data
    const updatedBusinessData = {
      ...currentBusiness.business_data,
      ...partialData
    };
    
    // Update the business record directly
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ 
        business_data: updatedBusinessData,
        ...(stage && { status: stage })
      })
      .eq('id', businessId);
    
    if (updateError) {
      console.error('Error in direct database update:', updateError);
      throw updateError;
    }
    
    console.log('Direct database update successful');
    return { success: true, method: 'direct_db_update' };
    
  } catch (error) {
    console.error('Direct database update failed:', error);
    throw error;
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
    
    // Update progress to show we're specifically working on products
    await supabase
      .from('sessions')
      .update({ progress: 65 })
      .eq('id', sessionId);
    
    try {
      const products = await createProducts(opportunity);
      businessData.products = products;
      
      // Update database with products - ensure this doesn't fail silently
      console.log('Updating database with products:', products?.length || 0);
      const updateResult = await updateBusinessProgress(businessId, { products });
      console.log('Product update result:', updateResult);
      
      // Also update session progress after successful product creation
      await supabase
        .from('sessions')
        .update({ progress: 70 })
        .eq('id', sessionId);
        
    } catch (productError) {
      console.error('Critical error in product creation:', productError);
      
      // Ensure we still have fallback products even if update fails
      const fallbackProducts = [
        { name: "Starter Package", price: "$97", description: "Essential services to get you started" },
        { name: "Professional Package", price: "$297", description: "Comprehensive solutions for established businesses" },
        { name: "Premium Package", price: "$597", description: "All-inclusive enterprise-grade services" }
      ];
      
      businessData.products = fallbackProducts;
      
      // Try to update database with fallback products
      try {
        await updateBusinessProgress(businessId, { products: fallbackProducts });
        console.log('Successfully saved fallback products');
      } catch (fallbackError) {
        console.error('Failed to save even fallback products:', fallbackError);
        // Continue anyway - products will be in businessData object
      }
      
      // Update progress to show we're moving forward despite the error
      await supabase
        .from('sessions')
        .update({ progress: 70 })
        .eq('id', sessionId);
    }
    
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
    
    // Determine if this is an e-commerce business
    const isEcommerce = opportunity.businessModel === 'ecommerce' || opportunity.isEcommerce;
    
    const prompt = `
      Create a professional website theme and layout for this ${isEcommerce ? 'e-commerce' : 'service'} business:
      ${JSON.stringify(opportunity)}
      
      IMPORTANT: For Hero backgrounds, create stunning visual elements using CSS:
      - Use sophisticated gradient backgrounds that match the business type perfectly
      - Create complementary gradient overlays for text readability  
      - Ensure the background enhances the business brand and message
      - Use modern CSS gradients and effects that appeal to the target audience
      
      IMPORTANT: Create realistic, specific testimonials based on the business type. Each testimonial should:
      - Reference actual results or benefits someone would get from this business
      - Use appropriate names and roles for the target audience
      - Include specific details that make them believable
      - Show clear value provided by the business
      
      ${isEcommerce ? `
      IMPORTANT: For e-commerce layout, include:
      - EcommerceProductGrid component instead of PricingTable
      - Navigation with cart functionality
      - Product categories and filtering
      - Customer reviews and ratings
      - Shopping-focused features
      ` : `
      IMPORTANT: For service business, include:
      - PricingTable with service packages
      - Professional service-focused content
      - Clear value propositions
      `}
      
      Return a JSON object with:
      {
        "theme": {
          "colors": {
            "primary": "#hexcode (choose colors that work well with gradients)",
            "secondary": "#hexcode (complementary color)",
            "textDark": "#1f2937",
            "textGray": "#6b7280",
            "borderColor": "#e5e7eb"
          },
          "font": "Inter, Poppins, or Montserrat - choose based on business type",
          "gradient": "CSS gradient that represents the business type",
          "heroBackground": "Sophisticated CSS gradient or pattern for hero section"
        },
        "layout": [
          {
            "component": "NavBar",
            "props": {
              "businessName": "Name",
              "logo": "Emoji",
              "links": ${isEcommerce ? '["Home", "Products", "Categories", "About", "Contact"]' : '["Home", "About", "Services", "Pricing", "Contact"]'},
              "ctaText": "Get Started",
              "isEcommerce": ${isEcommerce}
            }
          },
          {
            "component": "Hero",
            "props": {
              "title": "Hero title based on business",
              "subtitle": "Compelling subtitle",
              "ctaText": "${isEcommerce ? 'Shop Now' : 'Get Started'}",
              "ctaLink": "${isEcommerce ? '#products' : '#contact'}",
              "background": "Use the heroBackground from theme for stunning CSS-only visuals"
            }
          },
          ${isEcommerce ? `
          {
            "component": "EcommerceProductGrid",
            "props": {
              "title": "Featured Products",
              "subtitle": "Discover our best-selling items",
              "products": [], // Will be populated with generated products
              "categories": [] // Will be populated based on products
            }
          },
          ` : ''}
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
              "title": "What Our ${isEcommerce ? 'Customers' : 'Clients'} Say",
              "testimonials": [
                {
                  "name": "First Name + Last Name",
                  "role": "Job Title relevant to target customer",
                  "content": "Specific testimonial about results achieved with this business - include numbers, timeframes, or specific benefits. Make it realistic and believable for this business type.",
                  "avatar": "👨‍💼 or 👩‍💼 or similar professional emoji",
                  "rating": 5
                }
              ]
            }
          },
          ${!isEcommerce ? `
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
                }
              ]
            }
          },
          ` : ''}
          {
            "component": "CallToAction",
            "props": {
              "title": "${isEcommerce ? 'Start Shopping Today' : 'Ready to Get Started?'}",
              "subtitle": "${isEcommerce ? 'Discover amazing products with fast shipping' : 'Join thousands of satisfied customers today'}",
              "ctaText": "${isEcommerce ? 'Browse Products' : 'Start Now'}"
            }
          },
          {
            "component": "Footer",
            "props": {
              "companyName": "Business Name",
              "links": [
                { "href": "#privacy", "label": "Privacy Policy" },
                { "href": "#terms", "label": "Terms of Service" },
                { "href": "#shipping", "label": "${isEcommerce ? 'Shipping Info' : 'Support'}" }
              ]
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
    
    // Enhance result with business-specific CSS visuals
    const cssBackground = getBusinessCSSBackground(opportunity.niche, opportunity.businessType);
    if (result.layout) {
      const heroComponent = result.layout.find(component => component.component === 'Hero');
      if (heroComponent && !heroComponent.props.background) {
        heroComponent.props.background = cssBackground;
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
    
    // Provide fallback website data with CSS-only backgrounds
    const cssBackground = getBusinessCSSBackground(opportunity.niche, opportunity.businessType);
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
        heroBackground: cssBackground
      },
      layout: generateDefaultLayout(opportunity, cssBackground)
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
    const isEcommerce = opportunity.businessModel === 'ecommerce' || opportunity.isEcommerce;
    
    // For e-commerce businesses, always generate custom physical products
    // For service businesses, use curated offers for consistency
    if (!isEcommerce) {
      const curated = getCuratedOffers(opportunity);
      if (Array.isArray(curated) && curated.length >= 3) {
        console.log('Using curated service offers library for non-ecommerce business');
        return curated;
      }
    } else {
      console.log('Generating custom e-commerce products for business type:', opportunity.businessModel);
    }
    
    const prompt = `
      Create ${isEcommerce ? '6-8' : '3'} compelling ${isEcommerce ? 'physical products' : 'service offerings'} for this business:
      ${JSON.stringify(opportunity)}
      
      ${isEcommerce ? `
      For e-commerce products, each product should have:
      - A specific product name
      - An appropriate price for physical goods
      - A detailed product description
      - Product category
      - Available variants (colors, sizes, etc.) if applicable
      - Stock status
      - Product ratings (4.0-5.0)
      - High-quality product features
      - SKU identifier
      
      Return as a JSON object with a "products" array containing objects with:
      {
        "name": "Product Name",
        "price": "$XX.XX",
        "originalPrice": "$XX.XX", // if on sale
        "description": "Detailed product description",
        "category": "product category",
        "sku": "PRODUCT-SKU",
        "inStock": true,
        "rating": 4.5,
        "reviewCount": 127,
        "images": ["product-image-1.jpg"], // placeholder image names
        "variants": [
          {"name": "Black", "color": "#000000", "available": true},
          {"name": "White", "color": "#ffffff", "available": true}
        ],
        "features": ["Feature 1", "Feature 2", "Feature 3"],
        "sale": false
      }
      ` : `
      For service offerings, each should have:
      - A clear service name
      - An appropriate price point for the target market
      - A compelling description
      
      Return as a JSON object with a "products" array containing objects with:
      {
        "name": "Service Name",
        "price": "$XXX",
        "description": "Service description",
        "features": ["Feature 1", "Feature 2", "Feature 3"]
      }
      `}
    `;

    console.log('Calling OpenAI for product creation...');
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a product development and pricing expert." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }), 45000 // Increase timeout to 45 seconds
    );
    
    console.log('OpenAI response received for product creation');
    
    // Validate response structure before parsing
    if (!response?.choices?.[0]?.message?.content) {
      console.error('Invalid OpenAI response structure:', response);
      throw new Error('Invalid OpenAI response structure');
    }
    
    // Safely parse JSON with validation
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      console.error('Raw response content:', response.choices[0].message.content);
      throw new Error('Failed to parse OpenAI response as JSON');
    }
    
    // Validate the parsed response has products array
    if (!parsedResponse?.products || !Array.isArray(parsedResponse.products)) {
      console.error('Invalid products structure in response:', parsedResponse);
      throw new Error('Response missing valid products array');
    }
    
    // Validate each product has required fields and add IDs
    const validProducts = parsedResponse.products
      .filter(product => product?.name && product?.price && product?.description)
      .map(product => ({
        ...product,
        id: product.id || product.name.toLowerCase().replace(/\s+/g, '-')
      }));
    
    if (validProducts.length === 0) {
      console.error('No valid products found in response:', parsedResponse.products);
      throw new Error('No valid products in OpenAI response');
    }
    
  console.log('Products created successfully:', validProducts.length);
  return validProducts;
    
  } catch (error) {
    console.error("Error creating products:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    
    // Enhanced fallback products with business-specific customization
    const businessType = opportunity?.niche || opportunity?.businessName || 'business';
    console.log(`Using fallback products for ${businessType}`);
    
  return [
      { 
        name: "Starter Package", 
        price: "$97", 
        description: `Essential ${businessType.toLowerCase()} services to get you started and see immediate results` 
      },
      { 
        name: "Professional Package", 
        price: "$297", 
        description: `Comprehensive ${businessType.toLowerCase()} solutions for established operations with proven ROI` 
      },
      { 
        name: "Premium Package", 
        price: "$597", 
        description: `All-inclusive enterprise-grade ${businessType.toLowerCase()} services with dedicated support` 
      }
    ];
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
 * Gets business-specific CSS backgrounds (gradients and patterns)
 */
function getBusinessCSSBackground(niche, businessType) {
  const backgroundMap = {
    fitness: "linear-gradient(135deg, #667eea 0%, #764ba2 100%), radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%)",
    health: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%), radial-gradient(circle at 80% 20%, rgba(132, 250, 176, 0.4) 0%, transparent 50%)",
    business: "linear-gradient(135deg, #667eea 0%, #764ba2 100%), linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%)",
    technology: "linear-gradient(135deg, #667eea 0%, #764ba2 100%), conic-gradient(from 45deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.1) 180deg, transparent 360deg)",
    creative: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%), radial-gradient(circle at 30% 70%, rgba(255, 182, 193, 0.5) 0%, transparent 50%)",
    education: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%), repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
    food: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%), radial-gradient(circle at 60% 40%, rgba(255, 140, 0, 0.3) 0%, transparent 50%)",
    finance: "linear-gradient(135deg, #2c3e50 0%, #3498db 100%), linear-gradient(90deg, rgba(255,255,255,0.05) 50%, transparent 50%)",
    realestate: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%), polygon(50% 0%, 0% 100%, 100% 100%)",
    consulting: "linear-gradient(135deg, #667eea 0%, #764ba2 100%), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
    default: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  };
  
  const lowerNiche = niche?.toLowerCase() || '';
  const lowerType = businessType?.toLowerCase() || '';
  
  // Check niche first, then business type
  for (const [key, background] of Object.entries(backgroundMap)) {
    if (lowerNiche.includes(key) || lowerType.includes(key)) {
      return background;
    }
  }
  
  return backgroundMap.default;
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
 * @param {string} cssBackground - CSS background for hero section
 * @returns {Array} Default layout configuration
 */
function generateDefaultLayout(opportunity, cssBackground = null) {
  const background = cssBackground || getBusinessCSSBackground(opportunity.niche, opportunity.businessType);
  const isEcommerce = opportunity.businessModel === 'ecommerce' || opportunity.isEcommerce;
  
  return [
    {
      component: 'NavBar',
      props: {
        businessName: opportunity.businessName || 'Your Business',
        logo: '🚀',
        links: isEcommerce ? 
          ['Home', 'Products', 'Categories', 'About', 'Contact'] :
          ['About', 'Services', 'Pricing', 'Contact'],
        ctaText: 'Get Started',
        isEcommerce: isEcommerce
      }
    },
    {
      component: 'Hero',
      props: {
        title: opportunity.solution || 'Transform Your Business',
        subtitle: opportunity.problem || 'Professional solutions tailored to your needs',
        ctaText: isEcommerce ? 'Shop Now' : 'Get Started Today',
        background: background
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
            description: isEcommerce ? 'Quick shipping with quality products' : 'Quick turnaround times with consistent quality results'
          },
          {
            icon: '🎯',
            title: isEcommerce ? 'Curated Selection' : 'Targeted Solutions',
            description: isEcommerce ? 'Hand-picked products for quality and value' : 'Customized approaches designed for your specific needs'
          },
          {
            icon: '🚀',
            title: isEcommerce ? 'Customer Focused' : 'Growth Focused',
            description: isEcommerce ? 'Exceptional service and support' : 'Strategies that scale with your business success'
          }
        ]
      }
    },
    ...(isEcommerce ? [{
      component: 'EcommerceProductGrid',
      props: {
        title: 'Featured Products',
        subtitle: 'Discover our amazing collection',
        products: [], // Will be populated with generated products
        categories: []
      }
    }] : [{
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
    }]),
    {
      component: 'CallToAction',
      props: {
        title: isEcommerce ? 'Start Shopping Today' : 'Ready to Get Started?',
        subtitle: isEcommerce ? 'Discover amazing products with fast shipping' : 'Join thousands of satisfied customers today',
        ctaText: isEcommerce ? 'Browse Products' : 'Start Now'
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
