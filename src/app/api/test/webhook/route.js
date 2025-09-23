// Test webhook without signature verification for development
// src/app/api/test/webhook/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

import { calculateRevenueShare } from '@/lib/revenue-share-calculator';

export async function POST(request) {
  try {
    const event = await request.json();
    
    console.log('Test webhook received event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const businessId = session.metadata?.business_id;
      
      if (!businessId) {
        return Response.json({ error: 'No business ID in metadata' }, { status: 400 });
      }

      const amount = (session.amount_total || 0) / 100; // Convert from cents

      // Insert sale record
      await supabase.from('sales').insert({
        business_id: businessId,
        stripe_session_id: session.id,
        amount,
        currency: session.currency || 'usd',
        customer_email: session.customer_details?.email || null,
        customer_name: session.customer_details?.name || null
      });

      // Update business revenue and available balance with revenue share
      const { data: biz } = await supabase
        .from('businesses')
        .select('total_revenue, available_balance, first_sale_date, plan_tier')
        .eq('id', businessId)
        .single();

      // Calculate revenue share
      const revenueShare = calculateRevenueShare(biz, amount);
      const newTotal = (biz?.total_revenue || 0) + amount; // Full amount for tracking
      const newAvailable = (biz?.available_balance || 0) + revenueShare.businessAmount; // Only business portion
      
      console.log(`💰 Test Revenue Share: $${amount} sale → $${revenueShare.launchflyFee.toFixed(2)} to Launchfly (${(revenueShare.percentage * 100).toFixed(1)}%), $${revenueShare.businessAmount.toFixed(2)} to business`);
      
      const updates = { 
        total_revenue: newTotal,
        available_balance: newAvailable,
        last_sale_date: new Date().toISOString() 
      };
      
      if (!biz?.first_sale_date) {
        updates.first_sale_date = new Date().toISOString();
      }

      await supabase
        .from('businesses')
        .update(updates)
        .eq('id', businessId);

      console.log(`✅ Webhook processed: $${amount} added, total now $${newTotal}`);

      return Response.json({ 
        received: true, 
        processed: true,
        amount,
        newTotal
      });
    }

    return Response.json({ received: true, processed: false });

  } catch (error) {
    console.error('Test webhook error:', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
