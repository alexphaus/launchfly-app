// src/app/api/business/update-revenue/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, amount, stripeSessionId, customerEmail, customerName } = await request.json();

    console.log('Updating revenue for business:', businessId, 'Amount:', amount);

    // Insert sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: businessId,
        stripe_session_id: stripeSessionId,
        amount: amount,
        currency: 'usd',
        customer_email: customerEmail,
        customer_name: customerName,
        created_at: new Date().toISOString()
      });

    if (saleError) {
      console.error('Error inserting sale:', saleError);
      return Response.json({ error: 'Failed to record sale' }, { status: 500 });
    }

    // Get current business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('total_revenue, first_sale_date')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Calculate new total revenue
    const currentRevenue = business?.total_revenue || 0;
    const newTotal = currentRevenue + amount;

    // Update business revenue
    const updates = { 
      total_revenue: newTotal, 
      last_sale_date: new Date().toISOString() 
    };

    // Set first sale date if this is the first sale
    if (!business?.first_sale_date) {
      updates.first_sale_date = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId);

    if (updateError) {
      console.error('Error updating business revenue:', updateError);
      return Response.json({ error: 'Failed to update revenue' }, { status: 500 });
    }

    console.log(`✅ Revenue updated! Previous: $${currentRevenue}, New: $${newTotal}`);

    return Response.json({ 
      success: true, 
      previousRevenue: currentRevenue,
      newRevenue: newTotal,
      saleAmount: amount
    });

  } catch (error) {
    console.error('Revenue update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
