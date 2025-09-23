// src/app/api/analytics/visitor/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, subdomain, visitorId, pageUrl } = await request.json();
    
    if (!businessId && !subdomain) {
      return NextResponse.json({ error: 'Business ID or subdomain required' }, { status: 400 });
    }
    
    let businessRecord = null;
    
    // Get business by ID or subdomain
    if (businessId) {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (!error && data) {
        businessRecord = data;
      }
    } else if (subdomain) {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', subdomain)
        .single();
      
      if (!error && data) {
        businessRecord = data;
      }
    }
    
    if (!businessRecord) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Increment visitor count
    const currentViews = Number(businessRecord.views || 0);
    const currentTotalVisitors = Number(businessRecord.total_visitors || 0);
    
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        views: currentViews + 1,
        total_visitors: currentTotalVisitors + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessRecord.id);
    
    if (updateError) {
      console.error('Error updating visitor count:', updateError);
      return NextResponse.json({ error: 'Failed to update visitor count' }, { status: 500 });
    }
    
    // Log activity for AI tracking
    try {
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessRecord.id,
          type: 'website_visit',
          message: `Website visitor viewed ${pageUrl || 'homepage'}`,
          metadata: {
            visitorId: visitorId || 'anonymous',
            pageUrl: pageUrl || '/',
            timestamp: new Date().toISOString(),
            subdomain: businessRecord.subdomain
          }
        });
    } catch (activityError) {
      // Don't fail the request if activity logging fails
      console.error('Error logging visitor activity:', activityError);
    }
    
    return NextResponse.json({ 
      success: true, 
      views: currentViews + 1,
      totalVisitors: currentTotalVisitors + 1
    });
    
  } catch (error) {
    console.error('Visitor tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
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
