// Debug Automatic Fulfillment Flow
// This script helps debug why automatic fulfillment doesn't work on real purchases

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debugAutomaticFulfillment() {
  console.log('🔍 DEBUG: Automatic Fulfillment Flow');
  console.log('==========================================\n');

  try {
    // 1. Check recent sales for your email
    console.log('1. 📊 Checking recent sales for axpg31@gmail.com...');
    const { data: recentSales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        customer_email,
        customer_name,
        product_name,
        amount,
        currency,
        payment_status,
        stripe_session_id,
        created_at,
        business_id
      `)
      .eq('customer_email', 'axpg31@gmail.com')
      .order('created_at', { ascending: false })
      .limit(5);

    if (salesError) {
      console.error('❌ Error fetching sales:', salesError);
      return;
    }

    if (!recentSales || recentSales.length === 0) {
      console.log('⚠️  No recent sales found for axpg31@gmail.com');
      return;
    }

    console.log(`✅ Found ${recentSales.length} recent sales:`);
    recentSales.forEach((sale, index) => {
      console.log(`  ${index + 1}. Sale ID: ${sale.id}`);
      console.log(`     Product: ${sale.product_name}`);
      console.log(`     Amount: $${sale.amount}`);
      console.log(`     Status: ${sale.payment_status}`);
      console.log(`     Created: ${new Date(sale.created_at).toLocaleString()}`);
      console.log(`     Stripe Session: ${sale.stripe_session_id}`);
      console.log('');
    });

    // 2. Check fulfillment records for these sales
    console.log('2. 🎯 Checking fulfillment records...');
    const saleIds = recentSales.map(s => s.id);
    
    const { data: fulfillments, error: fulfillmentError } = await supabase
      .from('fulfillments')
      .select(`
        id,
        sale_id,
        status,
        fulfillment_type,
        delivered_items,
        total_value,
        error_message,
        created_at,
        completed_at
      `)
      .in('sale_id', saleIds);

    if (fulfillmentError) {
      console.error('❌ Error fetching fulfillments:', fulfillmentError);
      return;
    }

    if (!fulfillments || fulfillments.length === 0) {
      console.log('❌ NO FULFILLMENT RECORDS FOUND!');
      console.log('   This means the webhook is not triggering fulfillment properly.');
      
      // Check if there's a fulfillments table
      const { data: tableCheck } = await supabase
        .from('fulfillments')
        .select('id')
        .limit(1);
      
      if (!tableCheck) {
        console.log('❌ Fulfillments table might not exist!');
      } else {
        console.log('✅ Fulfillments table exists but no records for recent sales');
      }
    } else {
      console.log(`✅ Found ${fulfillments.length} fulfillment records:`);
      fulfillments.forEach((fulfillment, index) => {
        console.log(`  ${index + 1}. Fulfillment ID: ${fulfillment.id}`);
        console.log(`     Sale ID: ${fulfillment.sale_id}`);
        console.log(`     Status: ${fulfillment.status}`);
        console.log(`     Type: ${fulfillment.fulfillment_type}`);
        console.log(`     Created: ${new Date(fulfillment.created_at).toLocaleString()}`);
        console.log(`     Completed: ${fulfillment.completed_at ? new Date(fulfillment.completed_at).toLocaleString() : 'Not completed'}`);
        if (fulfillment.error_message) {
          console.log(`     ❌ Error: ${fulfillment.error_message}`);
        }
        if (fulfillment.delivered_items) {
          console.log(`     📦 Delivered ${fulfillment.delivered_items.length} items`);
        }
        console.log('');
      });
    }

    // 3. Check fulfillment content for email delivery
    console.log('3. 📧 Checking fulfillment content...');
    const { data: fulfillmentContent, error: contentError } = await supabase
      .from('fulfillment_content')
      .select(`
        id,
        business_id,
        recipient_email,
        content_type,
        status,
        email_sent,
        email_sent_at,
        created_at
      `)
      .eq('recipient_email', 'axpg31@gmail.com')
      .order('created_at', { ascending: false })
      .limit(10);

    if (contentError) {
      console.error('❌ Error fetching fulfillment content:', contentError);
    } else if (!fulfillmentContent || fulfillmentContent.length === 0) {
      console.log('❌ NO FULFILLMENT CONTENT FOUND!');
      console.log('   This means no AI content was generated or emails were sent.');
    } else {
      console.log(`✅ Found ${fulfillmentContent.length} fulfillment content records:`);
      fulfillmentContent.forEach((content, index) => {
        console.log(`  ${index + 1}. Content ID: ${content.id}`);
        console.log(`     Type: ${content.content_type}`);
        console.log(`     Status: ${content.status}`);
        console.log(`     Email Sent: ${content.email_sent ? '✅' : '❌'}`);
        console.log(`     Email Sent At: ${content.email_sent_at ? new Date(content.email_sent_at).toLocaleString() : 'Never'}`);
        console.log(`     Created: ${new Date(content.created_at).toLocaleString()}`);
        console.log('');
      });
    }

    // 4. Test webhook endpoint manually
    console.log('4. 🧪 Testing fulfillment trigger endpoint...');
    if (recentSales.length > 0) {
      const testSaleId = recentSales[0].id;
      console.log(`Testing with most recent sale ID: ${testSaleId}`);
      
      try {
        const response = await fetch('http://localhost:3000/api/fulfillment/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            saleId: testSaleId
          })
        });
        
        const responseText = await response.text();
        console.log(`Response Status: ${response.status}`);
        console.log(`Response Body: ${responseText}`);
        
        if (response.ok) {
          console.log('✅ Fulfillment trigger endpoint works!');
        } else {
          console.log('❌ Fulfillment trigger endpoint failed!');
        }
        
      } catch (error) {
        console.log('❌ Error calling fulfillment trigger:', error.message);
        console.log('   This might mean the development server is not running.');
      }
    }

    // 5. Check environment variables
    console.log('5. 🔧 Checking environment configuration...');
    console.log(`NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL || 'Not set (will default to localhost:3000)'}`);
    console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'Set ✅' : 'Not set ❌'}`);
    console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set ✅' : 'Not set ❌'}`);

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug
debugAutomaticFulfillment();
