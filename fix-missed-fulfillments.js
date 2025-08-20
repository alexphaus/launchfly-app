// Manual Fulfillment Trigger for Missed Sales
// Run this script to trigger fulfillment for sales that didn't get automatic fulfillment

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function triggerMissedFulfillments() {
  console.log('🔧 MANUAL FULFILLMENT TRIGGER');
  console.log('==============================\n');

  try {
    // Get all sales for your email that don't have fulfillment records
    console.log('1. 🔍 Finding sales without fulfillment...');
    
    const { data: allSales, error: salesError } = await supabase
      .from('sales')
      .select('id, customer_email, customer_name, amount, created_at')
      .eq('customer_email', 'axpg31@gmail.com')
      .order('created_at', { ascending: false });

    if (salesError) {
      console.error('❌ Error fetching sales:', salesError);
      return;
    }

    if (!allSales || allSales.length === 0) {
      console.log('⚠️  No sales found for axpg31@gmail.com');
      return;
    }

    console.log(`✅ Found ${allSales.length} total sales`);

    // Check which sales have fulfillment records
    const saleIds = allSales.map(s => s.id);
    const { data: existingFulfillments } = await supabase
      .from('fulfillments')
      .select('sale_id')
      .in('sale_id', saleIds);

    const fulfilledSaleIds = new Set(existingFulfillments?.map(f => f.sale_id) || []);
    const missedSales = allSales.filter(sale => !fulfilledSaleIds.has(sale.id));

    if (missedSales.length === 0) {
      console.log('✅ All sales have fulfillment records!');
      return;
    }

    console.log(`\n2. 🎯 Found ${missedSales.length} sales without fulfillment:`);
    missedSales.forEach((sale, index) => {
      console.log(`   ${index + 1}. Sale ID: ${sale.id.substring(0, 8)}... ($${sale.amount}) - ${new Date(sale.created_at).toLocaleString()}`);
    });

    // Trigger fulfillment for each missed sale
    console.log('\n3. 🚀 Triggering fulfillment for missed sales...');
    
    for (const sale of missedSales) {
      try {
        console.log(`   Triggering fulfillment for sale: ${sale.id.substring(0, 8)}...`);
        
        const response = await fetch('http://localhost:3000/api/fulfillment/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            saleId: sale.id
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`   ✅ Fulfillment started: ${result.fulfillment_id?.substring(0, 8)}...`);
        } else {
          const errorText = await response.text();
          console.log(`   ❌ Failed: ${response.status} - ${errorText}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('\n4. ✅ Manual fulfillment trigger completed!');
    console.log('📧 You should receive fulfillment emails within the next 5 minutes.');
    console.log('💡 To fix automatic fulfillment, set up ngrok or deploy to production.');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the fix
triggerMissedFulfillments();
