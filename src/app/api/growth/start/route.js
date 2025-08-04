import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { BusinessEvents } from '@/lib/inngest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API route to start business growth strategies using Inngest
 */
export async function POST(request) {
  try {
    const { businessId } = await request.json();
    
    if (!businessId) {
      return Response.json({ error: 'Missing businessId parameter' }, { status: 400 });
    }
    
    console.log('Starting growth strategies for business:', businessId);
    
    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
      
    if (businessError) {
      console.error('Error fetching business data:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Trigger growth strategies via Inngest
    await inngest.send({
      name: BusinessEvents.GrowthStarted,
      data: {
        businessId,
        businessData: business.business_data
      }
    });
    
    // Update business to indicate growth is in progress
    await supabase
      .from('businesses')
      .update({ growth_in_progress: true })
      .eq('id', businessId);
    
    return Response.json({
      success: true,
      message: 'Growth strategies initiated successfully'
    });
    
  } catch (error) {
    console.error('Error starting growth strategies:', error);
    return Response.json({ 
      error: error.message 
    }, { 
      status: 500 
    });
  }
}

export const runtime = 'nodejs';
