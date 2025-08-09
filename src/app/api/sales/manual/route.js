// src/app/api/sales/manual/route.js
// Records non-Checkout payments that count toward guarantees (e.g., invoice deposits)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/sales/manual
// Payload: { businessId, amount, currency='usd', customer_email?, customer_name?, reference? }
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, amount, currency = 'usd', customer_email, customer_name, reference } = body || {};
    if (!businessId || !amount) {
      return Response.json({ error: 'Missing businessId or amount' }, { status: 400 });
    }

    // Insert sale row
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .insert({
        business_id: businessId,
        product_id: reference || 'manual',
        amount: Number(amount),
        currency,
        customer_email: customer_email || null,
        customer_name: customer_name || 'Manual',
        payment_status: 'completed',
        stripe_session_id: null
      })
      .select()
      .single();
    if (saleErr) throw saleErr;

    // Update aggregates & first payment
    const { data: biz } = await supabase.from('businesses').select('id, total_revenue, first_sale_date, first_payment_at').eq('id', businessId).single();
    const newTotal = (biz?.total_revenue || 0) + Number(amount);
    const updates = { total_revenue: newTotal, last_sale_date: new Date().toISOString() };
    if (!biz?.first_sale_date) {
      const ts = new Date().toISOString();
      updates.first_sale_date = ts;
      updates.first_payment_at = ts;
    }
    await supabase.from('businesses').update(updates).eq('id', businessId);

    return Response.json({ success: true, saleId: sale.id, total: newTotal });
  } catch (error) {
    console.error('Manual sale error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}



