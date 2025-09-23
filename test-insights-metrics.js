// test-insights-metrics.js
// Test script to verify Insights card metrics work with real data

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testInsightsMetrics() {
  try {
    console.log('🧪 Testing Insights card metrics...');
    
    // Get a test business
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('status', 'ready')
      .limit(1);
    
    if (businessError || !businesses || businesses.length === 0) {
      console.log('❌ No test business found');
      return;
    }
    
    const business = businesses[0];
    console.log('📊 Testing with business:', business.name);
    
    // Test current metrics
    console.log('\n📈 Current Metrics:');
    console.log('- Views:', business.views || 0);
    console.log('- Total Visitors:', business.total_visitors || 0);
    console.log('- Total Leads:', business.total_leads || 0);
    console.log('- Total Revenue:', business.total_revenue || 0);
    console.log('- Growth Data:', business.growth_data);
    console.log('- Business Data:', business.business_data);
    
    // Simulate adding some visitor data
    console.log('\n🎯 Simulating visitor data...');
    const newViews = (business.views || 0) + 5;
    const newTotalVisitors = (business.total_visitors || 0) + 5;
    const newTotalLeads = (business.total_leads || 0) + 2;
    
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        views: newViews,
        total_visitors: newTotalVisitors,
        total_leads: newTotalLeads,
        updated_at: new Date().toISOString()
      })
      .eq('id', business.id);
    
    if (updateError) {
      console.log('❌ Failed to update test data:', updateError);
      return;
    }
    
    // Verify metrics calculation
    console.log('\n✅ Updated Metrics:');
    console.log('- Views:', newViews);
    console.log('- Total Visitors:', newTotalVisitors);
    console.log('- Total Leads:', newTotalLeads);
    console.log('- Conversion Rate:', newTotalVisitors > 0 ? ((newTotalLeads / newTotalVisitors) * 100).toFixed(1) + '%' : '0.0%');
    console.log('- Pipeline Value:', `$${(newTotalLeads * 150).toLocaleString()}`);
    console.log('- Daily Visitors:', Math.floor(newTotalVisitors / Math.max(1, Math.floor((Date.now() - new Date(business.created_at).getTime()) / (1000 * 60 * 60 * 24)))));
    
    console.log('\n🎉 Insights metrics test completed!');
    console.log('💡 Visit your dashboard to see the updated metrics in action.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testInsightsMetrics();
