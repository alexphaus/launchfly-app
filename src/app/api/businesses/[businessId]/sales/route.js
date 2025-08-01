import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API route to fetch business sales
 * GET /api/businesses/[businessId]/sales
 */
export async function GET(request, { params }) {
  const { businessId } = params;
  const { searchParams } = new URL(request.url);
  
  // Pagination parameters
  const limit = parseInt(searchParams.get('limit') || '10');
  const page = parseInt(searchParams.get('page') || '1');
  const startIndex = (page - 1) * limit;
  
  try {
    // Get sales count for pagination
    const { count, error: countError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
      
    if (countError) throw countError;
      
    // Get paginated sales
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);
      
    if (error) throw error;
    
    // Calculate total metrics
    let metrics = {
      totalSales: count,
      totalRevenue: 0,
      averageSale: 0
    };
    
    if (count > 0) {
      // Fetch all sales for calculating total revenue (can be optimized with a SUM function if available)
      const { data: allSales, error: allSalesError } = await supabase
        .from('sales')
        .select('amount')
        .eq('business_id', businessId);
        
      if (!allSalesError && allSales) {
        metrics.totalRevenue = allSales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
        metrics.averageSale = metrics.totalRevenue / count;
      }
    }
    
    return NextResponse.json({ 
      sales,
      metrics,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
