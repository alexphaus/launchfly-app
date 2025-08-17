// src/app/api/debug/list-businesses/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET() {
  try {
    console.log('🔍 Listing all businesses...');
    
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error);
      return Response.json({ error: 'Database error', details: error }, { status: 500 });
    }
    
    if (!businesses || businesses.length === 0) {
      return Response.json({ 
        message: 'No businesses found',
        businesses: [],
        count: 0 
      });
    }
    
    console.log(`✅ Found ${businesses.length} business(es)`);
    
    // Add summary info for each business
    const businessSummary = businesses.map(business => ({
      id: business.id,
      name: business.name || 'Unnamed Business',
      subdomain: business.subdomain || 'none',
      industry: business.industry || 'Not specified',
      niche: business.niche || 'Not specified',
      created_at: business.created_at,
      product_count: business.products ? business.products.length : 0,
      has_products: business.products && business.products.length > 0,
      sample_products: business.products ? business.products.slice(0, 3).map(p => ({
        name: p.name,
        price: p.price,
        category: p.category
      })) : []
    }));
    
    return Response.json({
      success: true,
      count: businesses.length,
      businesses: businessSummary,
      latest_business: businessSummary[0] || null
    });
    
  } catch (error) {
    console.error('❌ Error listing businesses:', error);
    return Response.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}
