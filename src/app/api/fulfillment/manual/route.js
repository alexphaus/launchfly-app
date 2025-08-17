// src/app/api/fulfillment/manual/route.js
/**
 * Manual Fulfillment Trigger
 * 
 * This endpoint allows manually triggering fulfillment for existing sales
 * Useful for testing or handling cases where automatic fulfillment failed
 */

import { fulfillOrder } from '@/lib/fulfillment-core';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { saleId, businessId, force = false } = await request.json();
    
    console.log('🔧 Manual fulfillment trigger:', { saleId, businessId, force });
    
    let sale, business;
    
    // Option 1: Trigger by sale ID
    if (saleId) {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          businesses:business_id (*)
        `)
        .eq('id', saleId)
        .single();
        
      if (saleError || !saleData) {
        return Response.json({ error: 'Sale not found' }, { status: 404 });
      }
      
      sale = saleData;
      business = saleData.businesses;
    }
    
    // Option 2: Trigger for all unfulfilled sales of a business
    else if (businessId) {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
        
      if (businessError || !businessData) {
        return Response.json({ error: 'Business not found' }, { status: 404 });
      }
      
      business = businessData;
      
      // Get unfulfilled sales
      const { data: unfulfilled, error: unfulfilledError } = await supabase
        .from('sales')
        .select(`
          *,
          fulfillments!left(id, status)
        `)
        .eq('business_id', businessId)
        .eq('payment_status', 'completed');
        
      if (unfulfilledError) {
        return Response.json({ error: 'Failed to fetch sales' }, { status: 500 });
      }
      
      // Filter out already fulfilled sales (unless force is true)
      const salesToFulfill = unfulfilled.filter(s => 
        force || !s.fulfillments || s.fulfillments.length === 0 || 
        s.fulfillments.some(f => f.status === 'failed')
      );
      
      if (salesToFulfill.length === 0) {
        return Response.json({ 
          message: 'No unfulfilled sales found',
          total_sales: unfulfilled.length
        });
      }
      
      // Process each sale
      const results = [];
      for (const saleItem of salesToFulfill) {
        try {
          const result = await fulfillOrder(saleItem, business);
          results.push({
            sale_id: saleItem.id,
            status: 'success',
            delivered_items: result.delivered_items.length
          });
        } catch (error) {
          results.push({
            sale_id: saleItem.id,
            status: 'error',
            error: error.message
          });
        }
      }
      
      return Response.json({
        message: 'Batch fulfillment completed',
        processed: results.length,
        results: results
      });
    }
    
    else {
      return Response.json({ error: 'Either saleId or businessId required' }, { status: 400 });
    }
    
    // Check if already fulfilled (unless force is true)
    if (!force) {
      const { data: existingFulfillment } = await supabase
        .from('fulfillments')
        .select('id, status')
        .eq('sale_id', sale.id)
        .single();
        
      if (existingFulfillment && existingFulfillment.status === 'completed') {
        return Response.json({ 
          message: 'Sale already fulfilled',
          fulfillment_id: existingFulfillment.id,
          sale_id: sale.id
        });
      }
    }
    
    // Execute fulfillment
    console.log('🚀 Starting manual fulfillment for sale:', sale.id);
    const result = await fulfillOrder(sale, business);
    
    return Response.json({
      message: 'Fulfillment completed successfully',
      sale_id: sale.id,
      delivered_items: result.delivered_items.length,
      total_value: result.delivered_items.reduce((sum, item) => {
        const value = parseInt(item.content.estimated_value?.replace(/[^0-9]/g, '') || '0');
        return sum + value;
      }, 0),
      fulfillment_type: result.plan.type
    });
    
  } catch (error) {
    console.error('❌ Manual fulfillment error:', error);
    return Response.json({ 
      error: 'Fulfillment failed',
      details: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check fulfillment status
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const saleId = url.searchParams.get('saleId');
    const businessId = url.searchParams.get('businessId');
    
    if (saleId) {
      // Get fulfillment status for specific sale
      const { data, error } = await supabase
        .from('fulfillments')
        .select(`
          *,
          sales:sale_id (
            customer_name,
            customer_email,
            amount,
            product_id
          )
        `)
        .eq('sale_id', saleId)
        .single();
        
      if (error) {
        return Response.json({ error: 'Fulfillment not found' }, { status: 404 });
      }
      
      return Response.json(data);
    }
    
    else if (businessId) {
      // Get fulfillment status for all sales of a business
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          customer_name,
          amount,
          product_id,
          created_at,
          fulfillments (
            id,
            status,
            fulfillment_type,
            total_value,
            completed_at
          )
        `)
        .eq('business_id', businessId)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false });
        
      if (error) {
        return Response.json({ error: 'Failed to fetch sales' }, { status: 500 });
      }
      
      const summary = {
        total_sales: data.length,
        fulfilled_sales: data.filter(s => s.fulfillments.length > 0 && s.fulfillments[0].status === 'completed').length,
        pending_sales: data.filter(s => s.fulfillments.length === 0).length,
        failed_sales: data.filter(s => s.fulfillments.some(f => f.status === 'failed')).length,
        total_value_delivered: data.reduce((sum, s) => {
          const completed = s.fulfillments.find(f => f.status === 'completed');
          return sum + (completed?.total_value || 0);
        }, 0),
        sales: data
      };
      
      return Response.json(summary);
    }
    
    else {
      return Response.json({ error: 'Either saleId or businessId required' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error getting fulfillment status:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
