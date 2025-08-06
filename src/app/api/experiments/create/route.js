// src/app/api/experiments/create/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createDefaultExperiments } from '@/lib/conversion-optimizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId } = await request.json();
    
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }
    
    // Get business
    const { data: business, error } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();
    
    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Create default experiments if not exists
    const businessData = business.business_data || {};
    if (!businessData.experiments) {
      businessData.experiments = createDefaultExperiments();
      
      // Update business
      await supabase
        .from('businesses')
        .update({ 
          business_data: businessData,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      return NextResponse.json({ 
        success: true, 
        experiments: businessData.experiments 
      });
    }
    
    return NextResponse.json({ 
      message: 'Experiments already exist',
      experiments: businessData.experiments 
    });
    
  } catch (error) {
    console.error('Error creating experiments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}