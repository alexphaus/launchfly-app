// src/app/api/debug/fulfillment-content/route.js
/**
 * Debug endpoint to check fulfillment content data structure
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');
    
    if (!contentId) {
      return Response.json({ error: 'contentId required' }, { status: 400 });
    }
    
    console.log('🔍 Debugging fulfillment content for ID:', contentId);
    
    // Test the query
    const { data, error } = await supabase
      .from('fulfillment_content')
      .select(`
        *,
        sales!sale_id (
          customer_name,
          customer_email,
          amount,
          product_id,
          businesses!business_id (
            name,
            business_data
          )
        )
      `)
      .eq('id', contentId)
      .single();
      
    if (error) {
      console.error('❌ Query error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    console.log('✅ Query successful, data structure:', JSON.stringify(data, null, 2));
    
    return Response.json({
      success: true,
      data: data,
      structure: {
        hasContent: !!data,
        hasSales: !!data?.sales,
        hasBusinesses: !!data?.sales?.businesses,
        salesType: typeof data?.sales,
        businessesType: typeof data?.sales?.businesses
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
