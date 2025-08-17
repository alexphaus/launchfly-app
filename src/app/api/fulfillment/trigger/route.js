// src/app/api/fulfillment/trigger/route.js
/**
 * Fulfillment Trigger API
 * 
 * This endpoint is called automatically when a sale is completed
 * (from the Stripe webhook) to start the fulfillment process
 */

import { fulfillOrder } from '@/lib/fulfillment-core';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { saleId } = await request.json();
    
    console.log('🚀 Triggering fulfillment for sale:', saleId);
    
    // Get sale data
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();
      
    if (saleError || !sale) {
      console.error('Sale not found:', saleError);
      return Response.json({ error: 'Sale not found' }, { status: 404 });
    }
    
    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', sale.business_id)
      .single();
      
    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Check if fulfillment already exists
    const { data: existingFulfillment } = await supabase
      .from('fulfillments')
      .select('id, status')
      .eq('sale_id', saleId)
      .single();
      
    if (existingFulfillment) {
      console.log('Fulfillment already exists:', existingFulfillment.id);
      return Response.json({ 
        message: 'Fulfillment already processed',
        fulfillment_id: existingFulfillment.id,
        status: existingFulfillment.status
      });
    }
    
    // Create fulfillment record
    const { data: fulfillment, error: fulfillmentError } = await supabase
      .from('fulfillments')
      .insert({
        sale_id: saleId,
        status: 'processing',
        fulfillment_type: 'auto_generated'
      })
      .select()
      .single();
      
    if (fulfillmentError) {
      console.error('Error creating fulfillment record:', fulfillmentError);
      return Response.json({ error: 'Failed to create fulfillment record' }, { status: 500 });
    }
    
    // Start fulfillment process (async)
    fulfillOrder(sale, business)
      .then(result => {
        console.log('✅ Fulfillment completed successfully for sale:', saleId);
        
        // Update fulfillment record
        supabase
          .from('fulfillments')
          .update({
            status: 'completed',
            delivered_items: result.delivered_items,
            total_value: result.delivered_items.reduce((sum, item) => {
              const value = parseInt(item.content.estimated_value?.replace(/[^0-9]/g, '') || '0');
              return sum + value;
            }, 0),
            fulfillment_type: result.plan.type,
            completed_at: new Date().toISOString()
          })
          .eq('id', fulfillment.id)
          .then(({ error }) => {
            if (error) console.error('Error updating fulfillment:', error);
          });
      })
      .catch(error => {
        console.error('❌ Fulfillment failed for sale:', saleId, error);
        
        // Update fulfillment record with error
        supabase
          .from('fulfillments')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', fulfillment.id)
          .then(({ error: updateError }) => {
            if (updateError) console.error('Error updating fulfillment error:', updateError);
          });
      });
    
    return Response.json({
      message: 'Fulfillment started successfully',
      fulfillment_id: fulfillment.id,
      sale_id: saleId
    });
    
  } catch (error) {
    console.error('Error in fulfillment trigger:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
