// src/app/api/analytics/track/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { events } = await request.json();
    
    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid events data' }, { status: 400 });
    }
    
    // Process events in batches
    const processedEvents = [];
    
    for (const event of events) {
      // Validate required fields
      if (!event.businessId || !event.type) {
        continue;
      }
      
      // Create activity record for each event
      const activityData = {
        business_id: event.businessId,
        type: `analytics_${event.type}`,
        message: generateEventMessage(event),
        metadata: {
          visitorId: event.visitorId,
          sessionId: event.sessionId,
          experimentId: event.experimentId,
          variantId: event.variantId,
          eventType: event.type,
          eventData: event.data,
          timestamp: event.timestamp,
          url: event.url,
          viewport: event.viewport
        }
      };
      
      processedEvents.push(activityData);
      
      // Special handling for conversions
      if (event.type === 'conversion') {
        // Update business metrics
        await updateBusinessMetrics(event.businessId, event);
      }
    }
    
    // Batch insert events
    if (processedEvents.length > 0) {
      const { error } = await supabase
        .from('ai_activities')
        .insert(processedEvents);
      
      if (error) {
        console.error('Error inserting analytics events:', error);
        return NextResponse.json({ error: 'Failed to save events' }, { status: 500 });
      }
    }
    
    // Return success
    return NextResponse.json({ 
      success: true, 
      processed: processedEvents.length 
    });
    
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate human-readable message for event
 */
function generateEventMessage(event) {
  const messages = {
    pageview: `Visitor viewed page: ${event.data.title || event.url}`,
    click: `Visitor clicked ${event.data.element}: "${event.data.text}"`,
    conversion: `🎯 Conversion! Visitor clicked CTA: "${event.data.text}"`,
    scroll: `Visitor scrolled to ${event.data.depth}% of page`,
    engagement: `Visitor spent ${event.data.timeOnPage}s on page (${event.data.maxScrollDepth}% scroll)`,
    visibility: event.data.hidden ? 'Visitor switched tabs' : 'Visitor returned to page'
  };
  
  return messages[event.type] || `${event.type} event occurred`;
}

/**
 * Update business metrics for conversions
 */
async function updateBusinessMetrics(businessId, event) {
  try {
    // Get current business data
    const { data: business } = await supabase
      .from('businesses')
      .select('business_data, total_leads')
      .eq('id', businessId)
      .single();
    
    if (!business) return;
    
    // Update conversion count in business_data
    const businessData = business.business_data || {};
    
    if (!businessData.conversionMetrics) {
      businessData.conversionMetrics = {
        totalConversions: 0,
        conversionsByVariant: {},
        lastConversionAt: null
      };
    }
    
    businessData.conversionMetrics.totalConversions++;
    businessData.conversionMetrics.lastConversionAt = new Date().toISOString();
    
    // Track conversions by variant
    if (event.variantId) {
      if (!businessData.conversionMetrics.conversionsByVariant[event.variantId]) {
        businessData.conversionMetrics.conversionsByVariant[event.variantId] = 0;
      }
      businessData.conversionMetrics.conversionsByVariant[event.variantId]++;
    }
    
    // Update business record
    await supabase
      .from('businesses')
      .update({
        business_data: businessData,
        total_leads: (business.total_leads || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
  } catch (error) {
    console.error('Error updating business metrics:', error);
  }
}

// OPTIONS request for CORS
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}