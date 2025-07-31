import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, productId = 'test_product', amount = 99.99 } = await request.json();
    
    // Create a test sale
    const { data: sale, error } = await supabase
      .from('sales')
      .insert({
        business_id: businessId,
        product_id: productId,
        amount: amount,
        currency: 'usd',
        customer_email: 'test@example.com',
        customer_name: 'Test Customer',
        stripe_session_id: `test_session_${Date.now()}`,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    // Update business revenue
    const { data: business } = await supabase
      .from('businesses')
      .select('total_revenue')
      .eq('id', businessId)
      .single();
    
    const currentRevenue = business?.total_revenue || 0;
    const newRevenue = currentRevenue + amount;
    
    await supabase
      .from('businesses')
      .update({
        total_revenue: newRevenue,
        last_sale_date: new Date().toISOString(),
        first_sale_date: business?.first_sale_date || new Date().toISOString()
      })
      .eq('id', businessId);
    
    // Send test notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: businessId,
          saleId: sale.id,
          type: 'sale'
        })
      });
    } catch (notificationError) {
      console.error('Error sending test notification:', notificationError);
    }
    
    return Response.json({ 
      success: true, 
      sale: sale,
      message: 'Test sale created successfully!' 
    });
    
  } catch (error) {
    console.error('Error creating test sale:', error);
    return Response.json({ error: 'Failed to create test sale' }, { status: 500 });
  }
}
