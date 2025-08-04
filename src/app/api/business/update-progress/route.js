// app/api/business/update-progress/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API endpoint to update business data progressively during generation
 * This allows the UI to show updates as data becomes available
 */
export async function POST(request) {
  try {
    const { businessId, partialData, stage } = await request.json();
    
    if (!businessId || !partialData) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get current business data
    const { data: currentBusiness, error: fetchError } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching current business data:', fetchError);
      return Response.json({ error: 'Failed to fetch business data' }, { status: 500 });
    }
    
    // Merge the new partial data with existing data
    const updatedBusinessData = {
      ...currentBusiness.business_data || {},
      ...partialData
    };
    
    // Update the business record
    const updateData = { business_data: updatedBusinessData };
    if (stage) {
      updateData.status = stage;
    }
    
    const { error: updateError } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', businessId);
    
    if (updateError) {
      console.error('Error updating business data:', updateError);
      return Response.json({ error: 'Failed to update business data' }, { status: 500 });
    }
    
    return Response.json({ 
      success: true, 
      message: 'Business data updated successfully',
      updatedData: updatedBusinessData 
    });
    
  } catch (error) {
    console.error('Error in update-progress API:', error);
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ 
    message: 'Business progress update endpoint',
    methods: ['POST'],
    description: 'Updates business data progressively during generation'
  });
}
