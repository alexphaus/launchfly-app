// app/api/business/update-progress/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API endpoint to update business data progressively during generation
 * This allows the UI to show updates as data becomes available
 * Enhanced with better error handling and verification
 */
export async function POST(request) {
  const startTime = Date.now();
  
  try {
    const { businessId, partialData, stage } = await request.json();
    
    if (!businessId || !partialData) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log(`Updating business ${businessId} with data:`, Object.keys(partialData));
    
    // Get current business data with retry logic
    let currentBusiness;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', businessId)
        .single();
      
      if (!fetchError) {
        currentBusiness = data;
        break;
      }
      
      attempts++;
      console.error(`Attempt ${attempts} failed to fetch business data:`, fetchError);
      
      if (attempts >= maxAttempts) {
        return Response.json({ 
          error: 'Failed to fetch business data after retries',
          details: fetchError.message 
        }, { status: 500 });
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * attempts));
    }
    
    // Merge the new partial data with existing data (deep merge for complex objects)
    const existingData = currentBusiness.business_data || {};
    const updatedBusinessData = {
      ...existingData,
      ...partialData,
      // Ensure timestamps for tracking
      lastUpdated: new Date().toISOString(),
      updateSource: 'progress-api'
    };
    
    // Special handling for products array to ensure it's properly set
    if (partialData.products) {
      updatedBusinessData.products = partialData.products;
      console.log(`Setting products: ${partialData.products.length} items`);
    }
    
    // Update the business record with verification
    const { data: updateResult, error: updateError } = await supabase
      .from('businesses')
      .update({ 
        business_data: updatedBusinessData,
        updated_at: new Date().toISOString(),
        ...(stage && { status: stage })
      })
      .eq('id', businessId)
      .select('business_data');
    
    if (updateError) {
      console.error('Error updating business data:', updateError);
      return Response.json({ 
        error: 'Failed to update business data',
        details: updateError.message 
      }, { status: 500 });
    }
    
    // Verify the update was successful
    const finalData = updateResult[0]?.business_data;
    const hasProducts = finalData?.products?.length > 0;
    const hasExpectedKeys = Object.keys(partialData).every(key => finalData[key] !== undefined);
    
    const duration = Date.now() - startTime;
    console.log(`Business update completed in ${duration}ms. Products: ${hasProducts}, Keys verified: ${hasExpectedKeys}`);
    
    return Response.json({ 
      success: true, 
      message: 'Business data updated successfully',
      updatedData: updatedBusinessData,
      verification: {
        hasProducts,
        hasExpectedKeys,
        duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error in update-progress API after ${duration}ms:`, error);
    return Response.json({ 
      error: 'Internal server error',
      details: error.message,
      duration
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
