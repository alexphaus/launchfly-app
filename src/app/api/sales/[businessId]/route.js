import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  try {
    const { businessId } = params;
    
    // Get all sales for the business
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    // Calculate summary statistics
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.amount), 0);
    const totalSales = sales.length;
    
    // Get sales from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter(sale => new Date(sale.created_at) >= today);
    const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.amount), 0);
    
    // Get sales from this month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthSales = sales.filter(sale => new Date(sale.created_at) >= startOfMonth);
    const monthRevenue = monthSales.reduce((sum, sale) => sum + Number(sale.amount), 0);
    
    // Get unique customers
    const uniqueCustomers = new Set(sales.map(sale => sale.customer_email)).size;
    
    // Get recent sales (last 10)
    const recentSales = sales.slice(0, 10);
    
    return Response.json({
      summary: {
        totalRevenue,
        totalSales,
        todayRevenue,
        todaySales: todaySales.length,
        monthRevenue,
        monthSales: monthSales.length,
        uniqueCustomers
      },
      sales: recentSales,
      allSales: sales
    });
    
  } catch (error) {
    console.error('Error fetching sales:', error);
    return Response.json({ error: 'Failed to fetch sales data' }, { status: 500 });
  }
}
