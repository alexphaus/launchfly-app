// src/lib/conversion-optimizer.js
/**
 * Real-Time Conversion Optimization Engine
 * 
 * Handles A/B testing, visitor segmentation, and performance tracking
 * for self-improving landing pages
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import crypto from 'crypto';

/**
 * Generate a consistent visitor ID for tracking
 */
export function generateVisitorId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Get or create visitor ID from cookies
 */
export async function getVisitorId(cookieStore) {
  const existingCookie = cookieStore.get('launchfly_visitor_id');
  
  if (existingCookie) {
    return existingCookie.value;
  }
  
  // Generate new visitor ID
  // Note: In Next.js App Router, we can't set cookies in Server Components
  // The cookie will be set client-side by the tracking script
  return generateVisitorId();
}

/**
 * Determine visitor segment based on various factors
 */
export function getVisitorSegment(request) {
  const segments = {
    device: 'desktop',
    timeOfDay: 'day',
    trafficSource: 'direct',
    returning: false
  };
  
  // Device detection
  const userAgent = request.headers.get('user-agent') || '';
  if (/mobile/i.test(userAgent)) {
    segments.device = 'mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    segments.device = 'tablet';
  }
  
  // Time of day
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) {
    segments.timeOfDay = 'morning';
  } else if (hour >= 12 && hour < 17) {
    segments.timeOfDay = 'afternoon';
  } else if (hour >= 17 && hour < 22) {
    segments.timeOfDay = 'evening';
  } else {
    segments.timeOfDay = 'night';
  }
  
  // Traffic source
  const referer = request.headers.get('referer') || '';
  if (referer.includes('google.com')) {
    segments.trafficSource = 'google';
  } else if (referer.includes('facebook.com') || referer.includes('instagram.com')) {
    segments.trafficSource = 'social';
  } else if (referer) {
    segments.trafficSource = 'referral';
  }
  
  return segments;
}

/**
 * Assign variant based on visitor ID and active experiments
 */
export function assignVariant(visitorId, experiments) {
  if (!experiments || experiments.length === 0) {
    return null;
  }
  
  // Use visitor ID as seed for consistent assignment
  const hash = crypto.createHash('md5').update(visitorId).digest('hex');
  const hashNumber = parseInt(hash.substring(0, 8), 16);
  
  // Find active experiment
  const activeExperiment = experiments.find(exp => exp.status === 'active');
  if (!activeExperiment) {
    return null;
  }
  
  // Distribute traffic based on variant weights
  const totalWeight = activeExperiment.variants.reduce((sum, v) => sum + v.weight, 0);
  const random = (hashNumber % 100) / 100;
  let cumulative = 0;
  
  for (const variant of activeExperiment.variants) {
    cumulative += variant.weight / totalWeight;
    if (random <= cumulative) {
      return {
        experimentId: activeExperiment.id,
        variantId: variant.id,
        variant: variant
      };
    }
  }
  
  // Fallback to first variant
  return {
    experimentId: activeExperiment.id,
    variantId: activeExperiment.variants[0].id,
    variant: activeExperiment.variants[0]
  };
}

/**
 * Get active experiments for a business
 */
export async function getActiveExperiments(businessId, componentType = null) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  
  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();
    
    if (!business?.business_data?.experiments) {
      return [];
    }
    
    let experiments = business.business_data.experiments;
    
    // Filter by component type if specified
    if (componentType) {
      experiments = experiments.filter(exp => exp.componentType === componentType);
    }
    
    // Return only active experiments
    return experiments.filter(exp => exp.status === 'active');
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return [];
  }
}

/**
 * Record impression for tracking
 */
export async function recordImpression(data) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  
  try {
    // Store in a new analytics_events table or extend ai_activities
    await supabase
      .from('ai_activities')
      .insert({
        business_id: data.businessId,
        type: 'impression',
        message: `Visitor viewed ${data.component} - Variant ${data.variantId}`,
        metadata: {
          visitorId: data.visitorId,
          experimentId: data.experimentId,
          variantId: data.variantId,
          component: data.component,
          segments: data.segments,
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Error recording impression:', error);
  }
}

/**
 * Get winning variant based on performance
 */
export async function getWinningVariant(experimentId, businessId) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  
  try {
    // Get all events for this experiment
    const { data: events } = await supabase
      .from('ai_activities')
      .select('metadata')
      .eq('business_id', businessId)
      .eq('type', 'impression')
      .eq('metadata->>experimentId', experimentId);
    
    if (!events || events.length === 0) {
      return null;
    }
    
    // Calculate conversion rates per variant
    const variantStats = {};
    
    events.forEach(event => {
      const variantId = event.metadata.variantId;
      if (!variantStats[variantId]) {
        variantStats[variantId] = {
          impressions: 0,
          conversions: 0
        };
      }
      variantStats[variantId].impressions++;
    });
    
    // Get conversion events
    const { data: conversions } = await supabase
      .from('ai_activities')
      .select('metadata')
      .eq('business_id', businessId)
      .eq('type', 'conversion')
      .eq('metadata->>experimentId', experimentId);
    
    conversions?.forEach(event => {
      const variantId = event.metadata.variantId;
      if (variantStats[variantId]) {
        variantStats[variantId].conversions++;
      }
    });
    
    // Calculate conversion rates and find winner
    let winner = null;
    let highestRate = 0;
    
    Object.entries(variantStats).forEach(([variantId, stats]) => {
      const rate = stats.conversions / stats.impressions;
      if (rate > highestRate && stats.impressions >= 100) { // Minimum sample size
        highestRate = rate;
        winner = variantId;
      }
    });
    
    return winner;
  } catch (error) {
    console.error('Error getting winning variant:', error);
    return null;
  }
}

/**
 * Initialize default experiments for a business
 */
export function createDefaultExperiments() {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Hero Headline Test',
      componentType: 'Hero',
      status: 'active',
      createdAt: new Date().toISOString(),
      variants: [
        {
          id: 'control',
          name: 'Control',
          weight: 50,
          props: {} // Uses default props
        },
        {
          id: 'variant-a',
          name: 'Variant A - Benefit Focused',
          weight: 25,
          props: {
            title: '{businessName} - Boost Your Success by 300%',
            subtitle: 'Join thousands who transformed their business with our proven solutions'
          }
        },
        {
          id: 'variant-b', 
          name: 'Variant B - Urgency',
          weight: 25,
          props: {
            title: 'Limited Time: Transform Your {industry} Business Today',
            subtitle: 'Get started now and see results in just 7 days',
            ctaText: 'Start Free Trial'
          }
        }
      ]
    }
  ];
}

/**
 * Personalize content based on visitor segments
 */
export function personalizeContent(content, segments, businessData) {
  let personalized = { ...content };
  
  // Time-based personalization
  if (segments.timeOfDay === 'morning') {
    personalized.title = personalized.title?.replace('Today', 'This Morning');
  } else if (segments.timeOfDay === 'evening') {
    personalized.subtitle = personalized.subtitle?.replace('now', 'tonight');
  }
  
  // Device-based personalization
  if (segments.device === 'mobile') {
    personalized.ctaText = personalized.ctaText?.replace('Get Started', 'Tap to Start');
  }
  
  // Traffic source personalization
  if (segments.trafficSource === 'google') {
    personalized.subtitle = 'You found the #1 solution for ' + (businessData.industry || 'your business');
  } else if (segments.trafficSource === 'social') {
    personalized.subtitle = 'Join thousands who discovered us on social media';
  }
  
  // Replace placeholders with business data
  Object.entries(personalized).forEach(([key, value]) => {
    if (typeof value === 'string') {
      personalized[key] = value
        .replace('{businessName}', businessData.name || businessData.businessName || '')
        .replace('{industry}', businessData.industry || '');
    }
  });
  
  return personalized;
}