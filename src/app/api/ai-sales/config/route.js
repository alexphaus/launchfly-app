/**
 * @fileoverview AI Sales Agent configuration API
 * Handles CRUD operations for business AI agent settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '../../../../lib/ai-sales/rate-limiter';

export const runtime = 'nodejs';

/**
 * GET /api/ai-sales/config
 * Get AI agent configuration for a business
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Missing businessId parameter' },
        { status: 400 }
      );
    }
    
    // In production, fetch from Supabase
    const config = await getAIConfiguration(businessId);
    
    if (!config) {
      // Return default configuration
      return NextResponse.json(getDefaultConfiguration(businessId));
    }
    
    return NextResponse.json(config);
    
  } catch (error) {
    console.error('Config GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-sales/config
 * Save AI agent configuration
 */
export async function POST(request) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) {
      return NextResponse.json(rateLimitResult, { status: 429 });
    }
    
    const config = await request.json();
    
    // Validate configuration
    const validation = validateConfiguration(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validation.errors },
        { status: 400 }
      );
    }
    
    // Save to database
    const savedConfig = await saveAIConfiguration(config);
    
    return NextResponse.json({
      success: true,
      config: savedConfig,
      savedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Config POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai-sales/config
 * Update specific configuration sections
 */
export async function PUT(request) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) {
      return NextResponse.json(rateLimitResult, { status: 429 });
    }
    
    const { businessId, section, data } = await request.json();
    
    if (!businessId || !section || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: businessId, section, data' },
        { status: 400 }
      );
    }
    
    // Get existing configuration
    const existingConfig = await getAIConfiguration(businessId);
    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }
    
    // Update specific section
    const updatedConfig = {
      ...existingConfig,
      [section]: { ...existingConfig[section], ...data },
      updatedAt: new Date().toISOString()
    };
    
    // Validate and save
    const validation = validateConfiguration(updatedConfig);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid configuration update', details: validation.errors },
        { status: 400 }
      );
    }
    
    const savedConfig = await saveAIConfiguration(updatedConfig);
    
    return NextResponse.json({
      success: true,
      config: savedConfig,
      updatedSection: section
    });
    
  } catch (error) {
    console.error('Config PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-sales/config
 * Reset configuration to defaults
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Missing businessId parameter' },
        { status: 400 }
      );
    }
    
    // Reset to default configuration
    const defaultConfig = getDefaultConfiguration(businessId);
    const savedConfig = await saveAIConfiguration(defaultConfig);
    
    return NextResponse.json({
      success: true,
      config: savedConfig,
      message: 'Configuration reset to defaults'
    });
    
  } catch (error) {
    console.error('Config DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to reset configuration' },
      { status: 500 }
    );
  }
}

/**
 * Get AI configuration from database
 * @param {string} businessId - Business ID
 * @returns {Object|null} Configuration or null
 */
async function getAIConfiguration(businessId) {
  // In production, this would query Supabase:
  // const { createClient } = require('@supabase/supabase-js');
  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // 
  // const { data, error } = await supabase
  //   .from('ai_agent_configs')
  //   .select('*')
  //   .eq('business_id', businessId)
  //   .single();
  //
  // return error ? null : data.config;
  
  // For demo, return null to use defaults
  console.log('Loading AI config for business:', businessId);
  return null;
}

/**
 * Save AI configuration to database
 * @param {Object} config - Configuration to save
 * @returns {Object} Saved configuration
 */
async function saveAIConfiguration(config) {
  // In production, this would save to Supabase:
  // const { createClient } = require('@supabase/supabase-js');
  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // 
  // const { data, error } = await supabase
  //   .from('ai_agent_configs')
  //   .upsert({
  //     business_id: config.businessId,
  //     config: config,
  //     updated_at: new Date().toISOString()
  //   })
  //   .select()
  //   .single();
  //
  // if (error) throw error;
  // return data.config;
  
  // For demo, just return the config
  console.log('Saving AI config for business:', config.businessId);
  return {
    ...config,
    savedAt: new Date().toISOString()
  };
}

/**
 * Get default configuration for a business
 * @param {string} businessId - Business ID
 * @returns {Object} Default configuration
 */
function getDefaultConfiguration(businessId) {
  return {
    businessId,
    personality: {
      tone: 'friendly',
      avatar: null,
      name: 'Sales Assistant',
      greeting: 'Hi there! How can I help you today?',
      signature: 'Best regards'
    },
    knowledge: {
      businessDescription: 'We provide innovative solutions to help businesses grow.',
      products: [
        {
          id: 'starter',
          name: 'Starter Plan',
          description: 'Perfect for small businesses getting started',
          price: 99,
          features: ['Basic features', 'Email support', '5 users']
        },
        {
          id: 'pro',
          name: 'Pro Plan',
          description: 'Advanced features for growing businesses',
          price: 299,
          features: ['All Starter features', 'Priority support', 'Unlimited users']
        }
      ],
      faqs: [
        {
          id: 'pricing',
          question: 'What are your pricing options?',
          answer: 'We offer flexible pricing starting at $99/month with various plans to suit different business needs.'
        },
        {
          id: 'support',
          question: 'What kind of support do you provide?',
          answer: 'We provide email support for all plans, with priority support for Pro and Enterprise customers.'
        }
      ],
      objectionHandlers: [
        {
          objection: 'too expensive',
          response: 'I understand price is important. Let me show you the value and ROI our solution provides - most clients see returns within 2 months.'
        },
        {
          objection: 'need to think about it',
          response: 'Of course! Taking time to decide is smart. What specific aspects would help you make the best decision?'
        }
      ]
    },
    pricing: {
      basePrice: 99,
      minPrice: 49,
      maxDiscount: 30,
      allowNegotiation: true,
      approvedPaymentMethods: ['card'],
      volumeDiscounts: [],
      urgencyMultipliers: [
        { trigger: 'exit_intent', multiplier: 0.85 },
        { trigger: 'high_engagement', multiplier: 0.9 }
      ]
    },
    triggers: {
      intentThreshold: 45,
      timeDelay: 30,
      exitIntentEnabled: true,
      proactiveMessages: true,
      workingHoursOnly: false,
      workingHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'America/New_York',
        weekdays: [1, 2, 3, 4, 5]
      }
    },
    goals: {
      primary: 'maximize_revenue',
      targetConversionRate: 5,
      targetAOV: 299,
      focusProducts: []
    },
    advanced: {
      aggressiveness: 'medium',
      fallbackToHuman: true,
      humanHandoffThreshold: 3,
      collectFeedback: true,
      a11yCompliant: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Validate configuration data
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 */
function validateConfiguration(config) {
  const errors = [];
  
  // Required fields
  if (!config.businessId) {
    errors.push('businessId is required');
  }
  
  // Personality validation
  if (config.personality) {
    const validTones = ['professional', 'friendly', 'casual', 'enthusiastic'];
    if (config.personality.tone && !validTones.includes(config.personality.tone)) {
      errors.push('Invalid personality tone');
    }
  }
  
  // Pricing validation
  if (config.pricing) {
    if (config.pricing.maxDiscount && (config.pricing.maxDiscount < 0 || config.pricing.maxDiscount > 100)) {
      errors.push('Max discount must be between 0 and 100');
    }
    
    if (config.pricing.minPrice && config.pricing.basePrice && config.pricing.minPrice > config.pricing.basePrice) {
      errors.push('Min price cannot be greater than base price');
    }
  }
  
  // Triggers validation
  if (config.triggers) {
    if (config.triggers.intentThreshold && (config.triggers.intentThreshold < 0 || config.triggers.intentThreshold > 100)) {
      errors.push('Intent threshold must be between 0 and 100');
    }
  }
  
  // Goals validation
  if (config.goals) {
    const validGoals = ['maximize_revenue', 'maximize_conversions', 'maximize_aov'];
    if (config.goals.primary && !validGoals.includes(config.goals.primary)) {
      errors.push('Invalid primary goal');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}