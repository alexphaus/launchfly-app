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
    
    // Update database with products
    await updateBusinessProgress(businessId, { products });
    
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
            "primary": "#hexcode",
            "secondary": "#hexcode",
            "textDark": "#hexcode",
            "textGray": "#hexcode",
            "borderColor": "#hexcode"
          },
          "font": "Font name",
          "gradient": "CSS gradient string"
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
              "ctaLink": "#contact"
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
    
    // Provide fallback website data
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
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      },
      layout: generateDefaultLayout(opportunity)
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
    const prompt = `
      Create 3 compelling product or service offerings for this business:
      ${JSON.stringify(opportunity)}
      
      Each product should have:
      - A clear name
      - A compelling description
      - An appropriate price point for the target market
      
      Return as a JSON object with a "products" array containing objects with name, price, and description.
      Example format:
      {
        "products": [
          {"name": "Product Name", "price": "$99", "description": "Product description"},
          {"name": "Product Name 2", "price": "$199", "description": "Product description 2"},
          {"name": "Product Name 3", "price": "$299", "description": "Product description 3"}
        ]
      }
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
      })
    );
    
    console.log('OpenAI response received for product creation');
    const { products } = JSON.parse(response.choices[0].message.content);
    console.log('Products created successfully:', products?.length || 0);
    return products || [];
  } catch (error) {
    console.error("Error creating products:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type
    });
    
    // Fallback products
    return [
      { name: "Basic Package", price: "$97", description: "Essential services to get you started" },
      { name: "Professional Package", price: "$297", description: "Comprehensive solutions for established businesses" },
      { name: "Premium Package", price: "$597", description: "All-inclusive enterprise-grade services" }
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
 * @returns {Array} Default layout configuration
 */
function generateDefaultLayout(opportunity) {
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
        ctaText: 'Get Started Today'
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
