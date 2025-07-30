// lib/business-generator.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Business type inference based on user data
function inferBusinessType(userData) {
  const background = (userData.background || '').toLowerCase();
  const goals = (userData.goals || '').toLowerCase();
  const combined = `${background} ${goals}`.toLowerCase();
  
  if (combined.includes('fitness') || combined.includes('health') || combined.includes('gym') || combined.includes('trainer')) {
    return 'fitness';
  } else if (combined.includes('coach') || combined.includes('mentor') || combined.includes('consultant')) {
    return 'coaching';
  } else if (combined.includes('design') || combined.includes('creative') || combined.includes('art')) {
    return 'creative';
  } else if (combined.includes('tech') || combined.includes('software') || combined.includes('app')) {
    return 'technology';
  } else if (combined.includes('food') || combined.includes('restaurant') || combined.includes('catering')) {
    return 'food';
  } else if (combined.includes('education') || combined.includes('course') || combined.includes('teaching')) {
    return 'education';
  } else if (combined.includes('real estate') || combined.includes('property')) {
    return 'real-estate';
  } else if (combined.includes('finance') || combined.includes('accounting') || combined.includes('investment')) {
    return 'finance';
  } else if (combined.includes('marketing') || combined.includes('social media') || combined.includes('advertising')) {
    return 'marketing';
  } else if (combined.includes('law') || combined.includes('legal')) {
    return 'legal';
  }
  return 'consulting'; // Default fallback
}

// Visual style recommendations based on business type
function getVisualStyleForBusiness(businessType, userData) {
  const styles = {
    fitness: "Bold, energetic design with vibrant colors (oranges, blues, greens). Strong typography. Action-oriented imagery. High contrast and dynamic layouts.",
    coaching: "Professional yet warm design. Trust-building colors (blues, purples). Clean typography. Personal touch with authentic imagery.",
    creative: "Artistic, unique layouts with creative color palettes. Showcase visual work prominently. Typography as design element.",
    technology: "Modern, sleek design with cool colors (blues, grays, teals). Minimalist approach. Tech-forward typography.",
    food: "Warm, appetizing design with rich colors (reds, oranges, browns). Food photography focus. Inviting typography.",
    education: "Professional, approachable design with trustworthy colors (blues, greens). Clear hierarchy. Educational imagery.",
    'real-estate': "Luxurious, professional design with sophisticated colors (navy, gold, grays). High-end photography. Elegant typography.",
    finance: "Professional, trustworthy design with conservative colors (navy, grays, muted blues). Clean, authoritative typography.",
    marketing: "Dynamic, creative design with attention-grabbing colors. Showcase results and case studies prominently.",
    legal: "Professional, authoritative design with traditional colors (navy, gray, maroon). Formal typography. Trust-building elements.",
    consulting: "Professional, versatile design that can adapt to any industry. Balanced color palette. Clear, readable typography."
  };
  
  return styles[businessType] || styles.consulting;
}

// Generate dynamic layout templates based on business type
function generateLayoutTemplate(businessType) {
  const layouts = {
    fitness: `[
      {
        "component": "NavBar",
        "props": {
          "businessName": "Use businessName from above",
          "logo": "Use logo from above",
          "links": ["Home", "Programs", "Results", "About", "Contact"],
          "ctaText": "Start Today",
          "ctaLink": "#contact"
        }
      },
      {
        "component": "Hero",
        "props": {
          "title": "Transform Your Body, Transform Your Life",
          "subtitle": "Get the body you've always wanted with our proven fitness system",
          "ctaText": "Start Transformation",
          "ctaLink": "#programs",
          "secondaryCtaText": "See Results",
          "secondaryCtaLink": "#testimonials"
        }
      },
      {
        "component": "StatsSection",
        "props": {
          "title": "Proven Results",
          "subtitle": "Real transformations from real people",
          "stats": [
            {
              "number": "5000+",
              "label": "Transformations",
              "icon": "💪"
            },
            {
              "number": "30 lbs",
              "label": "Avg Weight Loss",
              "icon": "📉"
            },
            {
              "number": "90 days",
              "label": "To Results",
              "icon": "⏱️"
            },
            {
              "number": "98%",
              "label": "Success Rate",
              "icon": "🎯"
            }
          ]
        }
      },
      {
        "component": "FeatureGrid",
        "props": {
          "title": "Why Our System Works",
          "features": [
            {
              "icon": "🎯",
              "title": "Personalized Plans",
              "description": "Custom workouts designed for your body and goals"
            },
            {
              "icon": "📱",
              "title": "24/7 Support",
              "description": "Direct access to certified trainers via our app"
            },
            {
              "icon": "📊",
              "title": "Progress Tracking",
              "description": "See your transformation with detailed analytics"
            },
            {
              "icon": "🥗",
              "title": "Nutrition Guidance",
              "description": "Meal plans that fuel your transformation"
            }
          ]
        }
      },
      {
        "component": "TestimonialSlider",
        "props": {
          "title": "Real People, Real Results",
          "testimonials": [
            {
              "name": "Sarah Johnson",
              "role": "Lost 30 pounds",
              "content": "I finally found a program that works! Down 30 pounds and feeling incredible.",
              "avatar": "👩‍💼",
              "rating": 5
            },
            {
              "name": "Mike Chen",
              "role": "Built muscle",
              "content": "Gained 15 pounds of muscle and my confidence is through the roof!",
              "avatar": "💪",
              "rating": 5
            },
            {
              "name": "Lisa Rodriguez",
              "role": "Marathon Runner",
              "content": "Went from couch to marathon in 8 months with this incredible program!",
              "avatar": "🏃‍♀️",
              "rating": 5
            }
          ]
        }
      },
      {
        "component": "AboutSection",
        "props": {
          "title": "Meet Your Coach",
          "subtitle": "Certified Fitness Professional",
          "content": "With over 10 years of experience helping people transform their bodies and lives, I understand the challenges you face and know exactly how to overcome them.",
          "layout": "left",
          "ctaText": "My Story"
        }
      },
      {
        "component": "PricingTable",
        "props": {
          "title": "Choose Your Transformation",
          "subtitle": "Every plan includes our success guarantee",
          "plans": "Use products from above as pricing plans"
        }
      },
      {
        "component": "CallToAction",
        "props": {
          "title": "Ready to Transform Your Life?",
          "subtitle": "Join thousands who've already transformed their bodies",
          "ctaText": "Start My Transformation"
        }
      },
      {
        "component": "Footer",
        "props": {
          "businessName": "Use businessName from above",
          "description": "Use tagline from above"
        }
      }
    ]`,
    
    coaching: `[
      {
        "component": "NavBar",
        "props": {
          "businessName": "Use businessName from above",
          "logo": "Use logo from above",
          "links": ["Home", "About", "Services", "Success Stories", "Contact"],
          "ctaText": "Book Discovery Call",
          "ctaLink": "#contact"
        }
      },
      {
        "component": "Hero",
        "props": {
          "title": "Unlock Your Potential",
          "subtitle": "1-on-1 coaching to help you achieve breakthrough results",
          "ctaText": "Book Free Consultation",
          "ctaLink": "#contact",
          "secondaryCtaText": "Learn My Story",
          "secondaryCtaLink": "#about"
        }
      },
      {
        "component": "FeatureGrid",
        "props": {
          "title": "How I Help You Succeed",
          "features": [
            {
              "icon": "🎯",
              "title": "Clear Goal Setting",
              "description": "Define exactly what you want and create a roadmap to get there"
            },
            {
              "icon": "💪",
              "title": "Overcome Limiting Beliefs",
              "description": "Break through mental barriers holding you back"
            },
            {
              "icon": "📈",
              "title": "Sustainable Growth",
              "description": "Build habits and systems for long-term success"
            }
          ]
        }
      },
      {
        "component": "TestimonialSlider",
        "props": {
          "title": "Client Success Stories",
          "testimonials": [
            {
              "name": "Jennifer Adams",
              "role": "Business Owner",
              "content": "Tripled my revenue in 6 months with the clarity and confidence I gained",
              "avatar": "👩‍💼",
              "rating": 5
            }
          ]
        }
      },
      {
        "component": "PricingTable",
        "props": {
          "title": "Coaching Packages",
          "subtitle": "Choose the level of support that's right for you",
          "plans": "Use products from above as coaching packages"
        }
      },
      {
        "component": "CallToAction",
        "props": {
          "title": "Ready to Break Through to Your Next Level?",
          "subtitle": "Book a free strategy session to discuss your goals",
          "ctaText": "Book Free Session"
        }
      },
      {
        "component": "Footer",
        "props": {
          "businessName": "Use businessName from above",
          "description": "Use tagline from above"
        }
      }
    ]`,
    
    creative: `[
      {
        "component": "NavBar",
        "props": {
          "businessName": "Use businessName from above",
          "logo": "Use logo from above",
          "links": ["Home", "Portfolio", "Services", "About", "Contact"],
          "ctaText": "Start Project",
          "ctaLink": "#contact"
        }
      },
      {
        "component": "Hero",
        "props": {
          "title": "Bring Your Vision to Life",
          "subtitle": "Creative design solutions that make your brand unforgettable",
          "ctaText": "See My Work",
          "ctaLink": "#portfolio",
          "secondaryCtaText": "Start Project",
          "secondaryCtaLink": "#contact"
        }
      },
      {
        "component": "PortfolioSection",
        "props": {
          "title": "Featured Work",
          "subtitle": "A showcase of our creative solutions",
          "items": [
            {
              "title": "Brand Identity Project",
              "category": "branding",
              "description": "Complete brand transformation",
              "link": "#"
            },
            {
              "title": "Website Design",
              "category": "web",
              "description": "Modern, responsive design",
              "link": "#"
            },
            {
              "title": "Marketing Materials",
              "category": "print",
              "description": "Print and digital assets",
              "link": "#"
            }
          ]
        }
      },
      {
        "component": "AboutSection",
        "props": {
          "title": "Creative Excellence",
          "subtitle": "Passionate About Design",
          "content": "With years of experience in creative design, we transform ideas into visual masterpieces that captivate and convert.",
          "layout": "right",
          "ctaText": "Learn More About Us"
        }
      },
      {
        "component": "StatsSection",
        "props": {
          "title": "Creative Impact",
          "stats": [
            {
              "number": "500+",
              "label": "Projects Completed",
              "icon": "🎨"
            },
            {
              "number": "100+",
              "label": "Happy Clients",
              "icon": "😊"
            },
            {
              "number": "5★",
              "label": "Average Rating",
              "icon": "⭐"
            },
            {
              "number": "48hr",
              "label": "Turnaround",
              "icon": "⚡"
            }
          ]
        }
      },
      {
        "component": "PricingTable",
        "props": {
          "title": "Design Packages",
          "subtitle": "Professional design solutions for every budget",
          "plans": "Use products from above as design packages"
        }
      },
      {
        "component": "CallToAction",
        "props": {
          "title": "Ready to Stand Out?",
          "subtitle": "Let's create something amazing together",
          "ctaText": "Start My Project"
        }
      },
      {
        "component": "Footer",
        "props": {
          "businessName": "Use businessName from above",
          "description": "Use tagline from above"
        }
      }
    ]`,
    
    technology: `[
      {
        "component": "NavBar",
        "props": {
          "businessName": "Use businessName from above",
          "logo": "Use logo from above",
          "links": ["Home", "Solutions", "Technology", "About", "Contact"],
          "ctaText": "Get Demo",
          "ctaLink": "#contact"
        }
      },
      {
        "component": "Hero",
        "props": {
          "title": "Technology That Transforms",
          "subtitle": "Cutting-edge solutions for the digital age",
          "ctaText": "See Solutions",
          "ctaLink": "#features",
          "secondaryCtaText": "Book Demo",
          "secondaryCtaLink": "#contact"
        }
      },
      {
        "component": "StatsSection",
        "props": {
          "title": "Proven Results",
          "stats": [
            {
              "number": "99.9%",
              "label": "Uptime",
              "icon": "🔄"
            },
            {
              "number": "50ms",
              "label": "Response Time",
              "icon": "⚡"
            },
            {
              "number": "10k+",
              "label": "Active Users",
              "icon": "👥"
            },
            {
              "number": "24/7",
              "label": "Support",
              "icon": "🛟"
            }
          ]
        }
      },
      {
        "component": "FeatureGrid",
        "props": {
          "title": "Advanced Features",
          "features": [
            {
              "icon": "🚀",
              "title": "Lightning Fast",
              "description": "Optimized performance for maximum speed"
            },
            {
              "icon": "�",
              "title": "Enterprise Security",
              "description": "Bank-level security for your peace of mind"
            },
            {
              "icon": "📊",
              "title": "Real-time Analytics",
              "description": "Comprehensive insights and reporting"
            },
            {
              "icon": "🔧",
              "title": "Easy Integration",
              "description": "Seamless integration with existing systems"
            }
          ]
        }
      },
      {
        "component": "TestimonialSlider",
        "props": {
          "title": "Trusted by Industry Leaders",
          "testimonials": [
            {
              "name": "Tech Startup CEO",
              "role": "CEO, InnovateTech",
              "content": "This solution scaled our operations by 300% in just 6 months",
              "avatar": "👨‍�",
              "rating": 5
            }
          ]
        }
      },
      {
        "component": "PricingTable",
        "props": {
          "title": "Technology Plans",
          "subtitle": "Flexible pricing for businesses of all sizes",
          "plans": "Use products from above as technology packages"
        }
      },
      {
        "component": "CallToAction",
        "props": {
          "title": "Ready to Innovate?",
          "subtitle": "Join thousands of companies already using our platform",
          "ctaText": "Start Free Trial"
        }
      },
      {
        "component": "Footer",
        "props": {
          "businessName": "Use businessName from above",
          "description": "Use tagline from above"
        }
      }
    ]`
  };
  
  // Return specific layout or default consulting layout
  return layouts[businessType] || `[
    {
      "component": "NavBar",
      "props": {
        "businessName": "Use businessName from above",
        "logo": "Use logo from above",
        "links": ["Home", "Services", "About", "Contact"],
        "ctaText": "Get Started",
        "ctaLink": "#contact"
      }
    },
    {
      "component": "Hero",
      "props": {
        "title": "Transform Your Business",
        "subtitle": "Expert consulting to accelerate your growth",
        "ctaText": "Book Consultation",
        "ctaLink": "#contact",
        "secondaryCtaText": "Learn More",
        "secondaryCtaLink": "#about"
      }
    },
    {
      "component": "FeatureGrid",
      "props": {
        "title": "How We Help",
        "features": [
          {
            "icon": "📊",
            "title": "Strategic Planning",
            "description": "Data-driven strategies for sustainable growth"
          },
          {
            "icon": "⚡",
            "title": "Implementation",
            "description": "Turn plans into results with expert execution"
          },
          {
            "icon": "📈",
            "title": "Growth Optimization",
            "description": "Continuous improvement for maximum ROI"
          }
        ]
      }
    },
    {
      "component": "TestimonialSlider",
      "props": {
        "title": "Client Results",
        "testimonials": [
          {
            "name": "David Park",
            "role": "CEO",
            "content": "Doubled our revenue in 8 months with their strategic guidance",
            "avatar": "👨‍💼",
            "rating": 5
          }
        ]
      }
    },
    {
      "component": "PricingTable",
      "props": {
        "title": "Consulting Packages",
        "subtitle": "Choose the right level of support for your business",
        "plans": "Use products from above as consulting packages"
      }
    },
    {
      "component": "CallToAction",
      "props": {
        "title": "Ready to Accelerate Your Growth?",
        "subtitle": "Schedule a free strategy session today",
        "ctaText": "Book Free Session"
      }
    },
    {
      "component": "Footer",
      "props": {
        "businessName": "Use businessName from above",
        "description": "Use tagline from above"
      }
    }
  ]`;
}

export async function generateBusinessWithAI(userData, sessionId, businessId) {
  console.log('Starting business generation for session:', sessionId);
  
  const stages = [
    { stage: 'analyzing', progress: 25, duration: 1500 },
    { stage: 'researching', progress: 50, duration: 1500 },
    { stage: 'building', progress: 75, duration: 1500 },
    { stage: 'finalizing', progress: 95, duration: 1000 },
  ];

  // Update progress through stages
  for (const stage of stages) {
    console.log(`Updating to stage: ${stage.stage} with progress: ${stage.progress}`);
    
    const { data, error } = await supabase
      .from('sessions')
      .update({
        stage: stage.stage,
        progress: stage.progress
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating session:', error);
    } else {
      console.log('Successfully updated session:', data);
    }
    
    await new Promise(resolve => setTimeout(resolve, stage.duration));
  }

  // Generate business data with OpenAI
  console.log('Calling OpenAI API...');

  // Create dynamic, business-specific prompt that generates truly unique websites
  const businessType = inferBusinessType(userData);
  const visualStyle = getVisualStyleForBusiness(businessType, userData);
  
  const prompt = `You are a world-class web designer and business strategist. Create a stunning, unique website for this business.

BUSINESS CONTEXT:
${JSON.stringify(userData)}

INFERRED BUSINESS TYPE: ${businessType}
VISUAL STYLE DIRECTION: ${visualStyle}

Create a business that perfectly matches their profile with a UNIQUE, STUNNING website design.

CRITICAL REQUIREMENTS:
1. Make the layout UNIQUE - don't use the same component order for every business
2. Choose components that fit the business type (fitness needs different layout than consulting)
3. Create business-specific, compelling copy (not generic templates)
4. Design a cohesive visual theme that matches the business personality
5. Generate realistic, specific content based on the business type

Return a JSON object with this structure:

{
  "businessName": "Creative, memorable name that fits the business type",
  "tagline": "Compelling value proposition specific to this business",
  "domain": "businessname.com",
  "logo": "Perfect emoji that represents this business",
  "monthlyRevenue": "Realistic target based on business type",
  "products": [
    // 3-5 products with realistic pricing for this specific business type
  ],
  "targetCustomers": [
    // Specific demographics for this business type
  ],
  "marketingStrategy": {
    "channels": ["specific channels for this business type"],
    "monthlyBudget": "Realistic budget",
    "keyMessage": "Business-specific marketing message"
  },
  "competitors": [
    // Real competitors in this space
  ],
  "theme": {
    "colors": {
      "primary": "Color that fits business personality",
      "secondary": "Complementary color",
      "accent": "Accent color for highlights",
      "textDark": "#1a1a1a",
      "textGray": "#666666",
      "background": "#ffffff or subtle background",
      "borderColor": "#e5e5e5"
    },
    "font": "Font that matches business style (e.g., 'Playfair Display' for elegant, 'Poppins' for modern, 'Inter' for tech)",
    "gradient": "Beautiful gradient that matches business vibe",
    "style": "Visual style: modern|elegant|bold|creative|professional|minimalist|luxury",
    "mood": "Brand mood: energetic|calm|professional|playful|sophisticated|trustworthy"
  },
  "layout": ${generateLayoutTemplate(businessType)}
}

Return ONLY valid JSON.`;  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Use GPT-4 for better, more creative results
      messages: [
        {
          role: "system",
          content: "You are a world-class web designer and business strategist who creates stunning, unique websites. Every business you create should feel completely different and tailored to its specific industry and target audience. Be creative and specific - avoid generic templates."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8, // Higher creativity
      max_tokens: 3000, // More space for detailed responses
      response_format: { type: "json_object" }
    });

    console.log('OpenAI response received');
    
    const businessData = JSON.parse(completion.choices[0].message.content);
    
    // Ensure all required fields exist with proper structure
    const finalBusinessData = {
      businessName: businessData.businessName || "Your Business",
      tagline: businessData.tagline || "Transform your passion into profit",
      domain: businessData.domain || `business-${Date.now()}.com`,
      logo: businessData.logo || "🚀",
      revenue: businessData.monthlyRevenue || businessData.revenue || "$2,000-$5,000/month",
      monthlyRevenue: businessData.monthlyRevenue || "$2,000-$5,000/month",
      products: businessData.products || [],
      targetCustomers: businessData.targetCustomers || [],
      monthlyData: businessData.monthlyData || [
        { month: "Month 1", revenue: 500 },
        { month: "Month 2", revenue: 1200 },
        { month: "Month 3", revenue: 2800 },
        { month: "Month 4", revenue: 4200 },
        { month: "Month 5", revenue: 5500 },
        { month: "Month 6", revenue: 7200 }
      ],
      marketingStrategy: businessData.marketingStrategy || {},
      competitors: businessData.competitors || [],
      theme: businessData.theme || {
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
      layout: businessData.layout || []
    };
    
    // Update session to complete
    console.log('Updating session to complete...');
    const { data: finalUpdate, error: finalError } = await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId)
      .select()
      .single();
      
    if (finalError) {
      console.error('Error updating session to complete:', finalError);
    } else {
      console.log('Session marked as complete:', finalUpdate);
    }
    
    return finalBusinessData;
    
  } catch (error) {
    console.error('OpenAI generation error:', error);
    console.error('Error details:', error.message);
    
    // If OpenAI fails, return dynamic fallback data based on user input
    const businessType = inferBusinessType(userData);
    const fallbackBusinessNames = {
      fitness: "TransformFit Pro",
      coaching: "Peak Performance Coaching", 
      creative: "Visionary Design Studio",
      technology: "InnovateTech Solutions",
      food: "Artisan Kitchen Co",
      education: "MasterClass Academy",
      'real-estate': "Elite Property Group",
      finance: "Wealth Builder Advisors",
      marketing: "Growth Engine Marketing",
      legal: "Premier Legal Solutions",
      consulting: "Strategic Success Partners"
    };
    
    const fallbackLogos = {
      fitness: "💪",
      coaching: "🚀", 
      creative: "🎨",
      technology: "⚡",
      food: "🍽️",
      education: "📚",
      'real-estate': "🏠",
      finance: "💰",
      marketing: "📈",
      legal: "⚖️",
      consulting: "🎯"
    };
    
    const fallbackData = {
      businessName: fallbackBusinessNames[businessType] || "Success Pro Business",
      tagline: `Professional ${businessType} solutions that deliver results`,
      domain: `${fallbackBusinessNames[businessType]?.toLowerCase().replace(/\s+/g, '') || 'business'}.com`,
      logo: fallbackLogos[businessType] || "�",
      revenue: "$2,000-$5,000/month",
      monthlyRevenue: "$2,000-$5,000/month",
      products: [
        { name: "Starter Package", price: "$97", description: "Perfect for getting started" },
        { name: "Professional Package", price: "$297", description: "Complete solution with support" },
        { name: "Premium Package", price: "$497", description: "Everything + 1-on-1 guidance" }
      ],
      targetCustomers: [
        "Professionals seeking growth",
        "Small business owners",
        "Ambitious individuals"
      ],
      monthlyData: [
        { month: "Month 1", revenue: 500 },
        { month: "Month 2", revenue: 1200 },
        { month: "Month 3", revenue: 2800 },
        { month: "Month 4", revenue: 4200 },
        { month: "Month 5", revenue: 5500 },
        { month: "Month 6", revenue: 7200 }
      ],
      theme: {
        colors: {
          primary: "#3b82f6",
          secondary: "#1e40af",
          accent: "#10b981",
          textDark: "#1a1a1a",
          textGray: "#666666",
          background: "#ffffff",
          borderColor: "#e5e5e5"
        },
        font: "Inter",
        gradient: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
        style: "modern",
        mood: "professional"
      },
      layout: JSON.parse(generateLayoutTemplate(businessType))
    };
    
    // Still mark as complete even with fallback
    await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId);
    
    return fallbackData;
  }
}

// Export helper functions for testing
export { inferBusinessType, getVisualStyleForBusiness, generateLayoutTemplate };