import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId } = await request.json();
    
    console.log('Testing sale creation for business:', businessId);
    
    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
      
    if (businessError) {
      return Response.json({ error: 'Business not found', details: businessError });
    }
    
    // Create test sale data matching your schema
    const testSaleData = {
      business_id: businessId,
      product_id: 'test-product',
      amount: 99.99,
      currency: 'usd',
      customer_email: 'test@example.com',
      customer_name: 'Test Customer',
      stripe_session_id: `test_${Date.now()}`,
      payment_status: 'completed'
    };
    
    console.log('Inserting test sale:', testSaleData);
    
    // Insert test sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([testSaleData])
      .select()
      .single();
      
    if (saleError) {
      console.error('Sale creation error:', saleError);
      return Response.json({ 
        error: 'Failed to create sale', 
        details: saleError,
        saleData: testSaleData
      });
    }
    
    console.log('Test sale created:', sale);
    
    // Update business totals
    const isFirstSale = !business.first_sale_date;
    const newTotalRevenue = (business.total_revenue || 0) + testSaleData.amount;
    
    const businessUpdates = {
      total_revenue: newTotalRevenue,
      last_sale_date: new Date().toISOString()
    };
    
    if (isFirstSale) {
      businessUpdates.first_sale_date = new Date().toISOString();
    }
    
    const { error: updateError } = await supabase
      .from('businesses')
      .update(businessUpdates)
      .eq('id', businessId);
      
    if (updateError) {
      console.error('Business update error:', updateError);
      return Response.json({ 
        error: 'Failed to update business', 
        details: updateError,
        sale: sale
      });
    }
    
    return Response.json({ 
      success: true, 
      sale: sale,
      businessUpdates: businessUpdates,
      isFirstSale: isFirstSale
    });
    
  } catch (error) {
    console.error('Test sale error:', error);
    return Response.json({ 
      error: 'Test failed', 
      details: error.message 
    });
  }
}
