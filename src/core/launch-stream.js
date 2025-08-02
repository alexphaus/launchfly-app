// core/launch-stream.js - Create the business with real-time streaming
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Launches a business with streaming real-time updates
 * Shows website content, products, and marketing being built piece by piece
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @param {string} sessionId - Current session ID
 * @param {string} businessId - Business record ID
 * @param {Function} onUpdate - Callback for real-time updates
 * @returns {Object} Complete business data
 */
export async function launchBusinessStream(opportunity, sessionId, businessId, onUpdate) {
  console.log('Starting streaming business launch for:', opportunity.businessName);
  
  try {
    // Initialize business structure
    let businessData = {
      businessName: opportunity.businessName,
      tagline: opportunity.solution,
      domain: generateDomain(opportunity.businessName),
      logo: '🚀', // Will be updated with AI generation
      products: [],
      theme: {},
      layout: [],
      marketing: {}
    };

    // Send initial business info
    onUpdate({
      type: 'content',
      section: 'business_info',
      data: {
        businessName: businessData.businessName,
        tagline: businessData.tagline,
        domain: businessData.domain
      }
    });

    // 1. Generate website theme with streaming
    onUpdate({
      type: 'progress',
      section: 'website',
      message: 'Choosing colors and design theme...'
    });

    const websiteData = await generateWebsiteStream(opportunity, onUpdate);
    businessData.theme = websiteData.theme;
    businessData.layout = websiteData.layout;

    // 2. Generate products with streaming
    onUpdate({
      type: 'progress',
      section: 'products',
      message: 'Creating your product lineup...'
    });

    const products = await createProductsStream(opportunity, onUpdate);
    businessData.products = products;

    // 3. Generate marketing materials with streaming
    onUpdate({
      type: 'progress',
      section: 'marketing',
      message: 'Building marketing strategies...'
    });

    const marketing = await createMarketingStream(opportunity, onUpdate);
    businessData.marketing = marketing;

    // 4. Generate additional business elements
    onUpdate({
      type: 'progress',
      section: 'final',
      message: 'Adding finishing touches...'
    });

    // Generate logo
    const logo = await generateLogoStream(opportunity.niche, onUpdate);
    businessData.logo = logo;

    // Generate target customers
    const targetCustomers = await identifyTargetCustomersStream(opportunity, onUpdate);
    businessData.targetCustomers = targetCustomers;

    // Generate projected growth
    const monthlyData = generateProjectedGrowth();
    businessData.monthlyData = monthlyData;
    businessData.monthlyRevenue = opportunity.profitPotential;

    // Send final complete business data
    onUpdate({
      type: 'content',
      section: 'complete',
      data: businessData
    });

    console.log('Streaming business launch completed successfully');
    return businessData;

  } catch (error) {
    console.error('Error in streaming business launch:', error);
    throw error;
  }
}

/**
 * Generate website theme and layout with streaming updates
 */
async function generateWebsiteStream(opportunity, onUpdate) {
  try {
    onUpdate({
      type: 'progress',
      section: 'website',
      message: 'Analyzing your business style...'
    });

    const prompt = `Create a professional website theme and layout for: ${opportunity.businessName}
    
Business details:
- Niche: ${opportunity.niche}
- Solution: ${opportunity.solution}
- Target market: ${opportunity.targetMarket}

Return a JSON object with theme colors, fonts, and complete layout components.`;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert web designer creating modern, professional websites. Always return valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      stream: true
    });

    let accumulatedContent = '';
    let websiteData = { theme: {}, layout: [] };

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        accumulatedContent += content;
        
        // Try to parse partial JSON and send updates
        try {
          const partialData = JSON.parse(accumulatedContent);
          
          // Send theme updates as they come in
          if (partialData.theme && Object.keys(partialData.theme).length > 0) {
            onUpdate({
              type: 'content',
              section: 'theme',
              data: partialData.theme
            });
            websiteData.theme = partialData.theme;
          }

          // Send layout updates as they come in
          if (partialData.layout && partialData.layout.length > 0) {
            onUpdate({
              type: 'content',
              section: 'layout',
              data: partialData.layout
            });
            websiteData.layout = partialData.layout;
          }

        } catch (e) {
          // Continue accumulating if JSON is not complete yet
          onUpdate({
            type: 'progress',
            section: 'website',
            message: 'Designing page components...'
          });
        }
      }
    }

    // Final parse
    if (accumulatedContent) {
      try {
        websiteData = JSON.parse(accumulatedContent);
      } catch (e) {
        console.error('Final JSON parse error:', e);
        // Fallback to default theme
        websiteData = getDefaultWebsiteData(opportunity);
      }
    }

    onUpdate({
      type: 'content',
      section: 'website_complete',
      data: websiteData
    });

    return websiteData;
  } catch (error) {
    console.error('Error generating website with streaming:', error);
    return getDefaultWebsiteData(opportunity);
  }
}

/**
 * Generate products with streaming updates
 */
async function createProductsStream(opportunity, onUpdate) {
  try {
    const prompt = `Create 3-5 digital products for: ${opportunity.businessName}
    
Business context:
- Niche: ${opportunity.niche}
- Solution: ${opportunity.solution}
- Target market: ${opportunity.targetMarket}

Return a JSON array of products with name, price, description, features, and category.`;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a product strategist creating digital products. Always return valid JSON array." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      stream: true
    });

    let accumulatedContent = '';
    let products = [];

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        accumulatedContent += content;
        
        try {
          const data = JSON.parse(accumulatedContent);
          if (data.products && Array.isArray(data.products)) {
            // Send individual products as they're generated
            if (data.products.length > products.length) {
              const newProducts = data.products.slice(products.length);
              newProducts.forEach((product, index) => {
                onUpdate({
                  type: 'content',
                  section: 'product',
                  data: product,
                  index: products.length + index
                });
              });
              products = data.products;
            }
          }
        } catch (e) {
          onUpdate({
            type: 'progress',
            section: 'products',
            message: 'Crafting product details...'
          });
        }
      }
    }

    // Final parse
    if (accumulatedContent) {
      try {
        const data = JSON.parse(accumulatedContent);
        products = data.products || products;
      } catch (e) {
        console.error('Products JSON parse error:', e);
      }
    }

    onUpdate({
      type: 'content',
      section: 'products_complete',
      data: products
    });

    return products;
  } catch (error) {
    console.error('Error generating products with streaming:', error);
    return getDefaultProducts(opportunity);
  }
}

/**
 * Generate marketing materials with streaming updates
 */
async function createMarketingStream(opportunity, onUpdate) {
  try {
    onUpdate({
      type: 'progress',
      section: 'marketing',
      message: 'Creating marketing copy...'
    });

    const marketing = {
      emailSequence: await generateEmailSequenceStream(opportunity, onUpdate),
      socialPosts: await generateSocialPostsStream(opportunity, onUpdate),
      adCopy: await generateAdCopyStream(opportunity, onUpdate)
    };

    onUpdate({
      type: 'content',
      section: 'marketing_complete',
      data: marketing
    });

    return marketing;
  } catch (error) {
    console.error('Error generating marketing with streaming:', error);
    return getDefaultMarketing(opportunity);
  }
}

/**
 * Generate logo with streaming updates
 */
async function generateLogoStream(niche, onUpdate) {
  onUpdate({
    type: 'progress',
    section: 'logo',
    message: 'Selecting perfect logo...'
  });

  // For now, return an emoji based on niche
  const logoMap = {
    'consulting': '🎯',
    'coaching': '🚀',
    'design': '🎨',
    'marketing': '📈',
    'technology': '💻',
    'education': '📚',
    'health': '🏥',
    'fitness': '💪',
    'food': '🍽️',
    'travel': '✈️'
  };

  const logo = logoMap[niche.toLowerCase()] || '🚀';
  
  onUpdate({
    type: 'content',
    section: 'logo',
    data: logo
  });

  return logo;
}

/**
 * Identify target customers with streaming
 */
async function identifyTargetCustomersStream(opportunity, onUpdate) {
  onUpdate({
    type: 'progress',
    section: 'customers',
    message: 'Identifying your ideal customers...'
  });

  // Generate target customer profiles
  const customers = [
    {
      name: "Primary Customer",
      avatar: "👩‍💼",
      demographics: "Age 25-45, Professional",
      painPoints: [`Struggles with ${opportunity.problem}`],
      goals: [`Wants ${opportunity.solution}`]
    }
  ];

  onUpdate({
    type: 'content',
    section: 'customers',
    data: customers
  });

  return customers;
}

// Helper functions for streaming email, social posts, ad copy
async function generateEmailSequenceStream(opportunity, onUpdate) {
  onUpdate({
    type: 'progress',
    section: 'email',
    message: 'Writing email sequences...'
  });

  return [
    {
      subject: `Welcome to ${opportunity.businessName}!`,
      content: `Thanks for your interest in ${opportunity.solution}...`
    }
  ];
}

async function generateSocialPostsStream(opportunity, onUpdate) {
  onUpdate({
    type: 'progress',
    section: 'social',
    message: 'Creating social media content...'
  });

  return [
    `🚀 Transform your ${opportunity.niche} with ${opportunity.solution}! #business #growth`
  ];
}

async function generateAdCopyStream(opportunity, onUpdate) {
  onUpdate({
    type: 'progress',
    section: 'ads',
    message: 'Writing ad copy...'
  });

  return {
    headline: `${opportunity.solution} That Works`,
    description: `Join thousands who've solved ${opportunity.problem} with our proven system.`
  };
}

// Utility functions
function generateDomain(businessName) {
  return businessName.toLowerCase().replace(/\s+/g, '-') + '.com';
}

function generateProjectedGrowth() {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: Math.floor(Math.random() * 5000) + 1000,
    customers: Math.floor(Math.random() * 100) + 20
  }));
}

// Default fallback data
function getDefaultWebsiteData(opportunity) {
  return {
    theme: {
      colors: {
        primary: "#3b82f6",
        secondary: "#8b5cf6",
        textDark: "#1f2937",
        textGray: "#6b7280",
        borderColor: "#e5e7eb"
      },
      font: "Inter",
      gradient: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)"
    },
    layout: [
      {
        component: "NavBar",
        props: {
          businessName: opportunity.businessName,
          logo: "🚀",
          links: ["About", "Services", "Pricing", "Contact"]
        }
      }
    ]
  };
}

function getDefaultProducts(opportunity) {
  return [
    {
      name: "Starter Package",
      price: 99,
      description: `Perfect introduction to ${opportunity.solution}`,
      features: ["Basic features", "Email support", "30-day guarantee"]
    }
  ];
}

function getDefaultMarketing(opportunity) {
  return {
    emailSequence: [],
    socialPosts: [],
    adCopy: {}
  };
}
