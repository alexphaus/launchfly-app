// src/app/api/business/[businessId]/purchases/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  const { businessId } = params;

  if (!businessId) {
    return NextResponse.json({ success: false, error: 'Business ID is required' }, { status: 400 });
  }

  try {
    console.log('🔍 Fetching purchases for business ID:', businessId);

    // Fetch orders (website purchases)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    // Fetch sales (individual product sales)
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    console.log('📊 Orders found:', orders?.length || 0);
    console.log('💰 Sales found:', sales?.length || 0);

    if (ordersError) {
      console.error('Orders fetch error:', ordersError);
    }

    if (salesError) {
      console.error('Sales fetch error:', salesError);
    }

    // Also try fetching ALL orders/sales to see if there's data but wrong business_id
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, business_id, customer_email, total_amount, created_at')
      .limit(5);
      
    const { data: allSales } = await supabase
      .from('sales')
      .select('id, business_id, customer_email, amount, created_at')
      .limit(5);

    console.log('🔍 Sample orders in DB:', allOrders);
    console.log('🔍 Sample sales in DB:', allSales);

    // Combine and process the data
    const purchases = [];
    
    // Process orders
    if (orders) {
      orders.forEach(order => {
        purchases.push({
          id: `order-${order.id}`,
          type: 'order',
          customerEmail: order.customer_email,
          customerName: order.customer_name,
          amount: order.total_amount,
          status: order.status,
          stripeSessionId: order.stripe_session_id,
          createdAt: order.created_at,
          currency: order.currency || 'USD',
          source: 'website'
        });
      });
    }

    // Process sales
    if (sales) {
      sales.forEach(sale => {
        purchases.push({
          id: `sale-${sale.id}`,
          type: 'sale',
          customerEmail: sale.customer_email,
          customerName: sale.customer_name,
          amount: sale.amount,
          status: sale.payment_status,
          stripeSessionId: sale.stripe_session_id,
          createdAt: sale.created_at,
          currency: sale.currency || 'USD',
          productId: sale.product_id,
          source: 'website'
        });
      });
    }

    // Sort by creation date
    purchases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ 
      success: true, 
      purchases,
      totalOrders: orders?.length || 0,
      totalSales: sales?.length || 0
    });

  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch purchase data' 
    }, { status: 500 });
  }
}
