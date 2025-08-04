/**
 * Workflow Monitor
 * 
 * This script monitors the database for workflow progress and results
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function monitorWorkflow(sessionId, businessId) {
  console.log('🔍 Monitoring Workflow Progress');
  console.log('===============================');
  console.log(`Session ID: ${sessionId}`);
  console.log(`Business ID: ${businessId}`);
  console.log('');
  
  let attempts = 0;
  const maxAttempts = 30; // Monitor for 5 minutes (30 * 10 seconds)
  
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      // Check session progress
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      // Check business progress
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      // Check marketing campaigns
      const { data: campaigns } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('business_id', businessId);
      
      // Check email outreach
      const { data: outreach } = await supabase
        .from('email_outreach')
        .select('*')
        .eq('business_id', businessId);
      
      // Check growth experiments
      const { data: experiments } = await supabase
        .from('growth_experiments')
        .select('*')
        .eq('business_id', businessId);
      
      console.log(`\n📊 Check #${attempts} (${new Date().toLocaleTimeString()})`);
      console.log('----------------------------------------------------');
      console.log(`Session Stage: ${session?.stage || 'unknown'}`);
      console.log(`Business Status: ${business?.status || 'unknown'}`);
      console.log(`Marketing Campaigns: ${campaigns?.length || 0}`);
      console.log(`Email Outreach Records: ${outreach?.length || 0}`);
      console.log(`Growth Experiments: ${experiments?.length || 0}`);
      
      // Show latest campaign details if any
      if (campaigns && campaigns.length > 0) {
        const latest = campaigns[campaigns.length - 1];
        console.log(`Latest Campaign: ${latest.name} (${latest.status})`);
      }
      
      // Show latest outreach details if any
      if (outreach && outreach.length > 0) {
        const latest = outreach[outreach.length - 1];
        console.log(`Latest Outreach: ${latest.status} - ${latest.prospect_email || 'N/A'}`);
      }
      
      // Check if workflow is complete
      const isBusinessComplete = business?.status === 'complete';
      const hasCampaigns = campaigns && campaigns.length > 0;
      const hasOutreach = outreach && outreach.length > 0;
      
      if (isBusinessComplete && (hasCampaigns || hasOutreach)) {
        console.log('\n🎉 WORKFLOW COMPLETE!');
        console.log('=====================');
        console.log('✅ Business generation completed');
        console.log('✅ Growth strategies initiated');
        console.log('✅ Cold email campaigns created');
        break;
      }
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
      
    } catch (error) {
      console.error(`❌ Error during check #${attempts}:`, error.message);
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⏰ Monitoring timeout reached');
    console.log('The workflow may still be processing in the background');
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node monitor-workflow.js <sessionId> <businessId>');
  process.exit(1);
}

const [sessionId, businessId] = args;
monitorWorkflow(sessionId, businessId)
  .then(() => {
    console.log('\n📝 Monitoring complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal monitoring error:', error);
    process.exit(1);
  });
