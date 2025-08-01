/**
 * launch.js - Create the business
 * 
 * This module focuses on taking a validated opportunity and turning it into a functional business.
 * Following the future-proof approach, this layer uses whatever AI tools are best at the moment.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Launches a business based on the analyzed opportunity
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @param {string} sessionId - Current session ID
 * @param {string} businessId - Business record ID
 * @returns {Object} Complete business data
 */
export async function launchBusiness(opportunity, sessionId, businessId) {
  // Update session to show we're building
  await supabase
    .from('sessions')
    .update({
      stage: 'building',
      progress: 50
    })
    .eq('id', sessionId);
  
  try {
    // Generate website theme and layout
    const websiteData = await generateWebsite(opportunity);
    
    // Create digital products based on the opportunity
    const products = await createProducts(opportunity);
    
    // Generate marketing materials and strategies
    const marketing = await createMarketing(opportunity);
    
    // Integrate with the existing business structure
    const businessData = {
      businessName: opportunity.businessName,
      tagline: opportunity.solution,
      domain: generateDomain(opportunity.businessName),
      logo: await generateLogo(opportunity.niche),
      monthlyRevenue: opportunity.profitPotential,
      products: products,
      targetCustomers: await identifyTargetCustomers(opportunity),
      monthlyData: generateProjectedGrowth(),
      theme: websiteData.theme,
      layout: websiteData.layout,
      marketing: marketing
    };
    
    // Update session to finalizing
    await supabase
      .from('sessions')
      .update({
        stage: 'finalizing',
        progress: 75
      })
      .eq('id', sessionId);
    
    // Update business with generated data
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain.replace('.com', '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);
    
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
    const prompt = `
      Create a professional website theme and layout for this business:
      ${JSON.stringify(opportunity)}
      
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
          // Hero, FeatureGrid, TestimonialSlider, PricingTable, CallToAction, Footer
          // Use all available components with appropriate props
        ]
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert web designer that creates modern, professional website themes and layouts." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error generating website:", error);
    
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
    const prompt = `
      Create 3 compelling product or service offerings for this business:
      ${JSON.stringify(opportunity)}
      
      Each product should have:
      - A clear name
      - A compelling description
      - An appropriate price point for the target market
      - 3-5 key features or benefits
      - A unique ID (alphanumeric)
      
      Return as a JSON object with a "products" array containing objects with id, name, price, description, and features (array).
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a product development and pricing expert." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    
    const { products } = JSON.parse(response.choices[0].message.content);
    
    // Ensure each product has an ID and other required fields
    const enhancedProducts = (products || []).map((product, index) => {
      // Generate placeholder images
      const imageIndex = index % 5 + 1;
      const placeholderImage = `https://images.unsplash.com/photo-${1550000000000 + index * 1000}-example-product-${imageIndex}`;
      
      return {
        id: product.id || `product-${index + 1}-${Date.now().toString(36)}`,
        name: product.name,
        price: product.price,
        description: product.description,
        features: product.features || [
          "Quality guaranteed",
          "Professional support",
          "Satisfaction guarantee"
        ],
        image: product.image || placeholderImage
      };
    });
    
    return enhancedProducts;
  } catch (error) {
    console.error("Error creating products:", error);
    
    // Fallback products with all required fields
    return [
      {
        id: `product-basic-${Date.now().toString(36)}`,
        name: "Basic Package",
        price: "$97",
        description: "Essential services to get you started with everything you need to launch your business quickly.",
        features: ["Core functionality", "Email support", "30-day money-back guarantee"],
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e"
      },
      {
        id: `product-pro-${Date.now().toString(36)}`,
        name: "Professional Package",
        price: "$297", 
        description: "Comprehensive solutions for established businesses looking to scale their operations effectively.",
        features: ["All Basic features", "Premium support", "Advanced tools", "Priority access"],
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30"
      },
      {
        id: `product-premium-${Date.now().toString(36)}`,
        name: "Premium Package", 
        price: "$597",
        description: "All-inclusive enterprise-grade services for businesses requiring the highest level of service.",
        features: ["All Professional features", "Dedicated account manager", "Custom development", "24/7 support", "White-glove onboarding"],
        image: "https://images.unsplash.com/photo-1553456558-aff63285bdd1"
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a marketing expert specializing in growth strategies for new businesses." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error creating marketing:", error);
    
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
    const prompt = `Choose a single emoji that best represents a business in the "${niche}" niche. Return just the emoji character.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: prompt }
      ]
    });
    
    const emoji = response.choices[0].message.content.trim();
    return emoji.length > 2 ? '🚀' : emoji;
  } catch (error) {
    console.error("Error generating logo:", error);
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
    const prompt = `
      Based on this business opportunity:
      ${JSON.stringify(opportunity)}
      
      Identify 3 specific target customer segments that would benefit most from this business.
      Be specific about demographics, pain points, and motivations.
      Return as a JSON array of strings.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a customer research specialist." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    
    const { targetCustomers } = JSON.parse(response.choices[0].message.content);
    return targetCustomers || [];
  } catch (error) {
    console.error("Error identifying target customers:", error);
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
