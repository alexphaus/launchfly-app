import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  try {
    const { businessId } = params;

    // Get sales data for this business
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate totals
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
    const totalSales = sales.length;

    return Response.json({
      sales,
      totals: {
        revenue: totalRevenue,
        salesCount: totalSales
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
