// lib/business-generator.js
import { createClient } from '@supabase/supabase-js';
import { analyzeOpportunity, launchBusiness, growBusiness } from '../core';

// Create Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Generate a complete business using the future-proof architecture
 * This function orchestrates the entire business creation process
 * 
 * @param {Object} userData - User information from the form 
 * @param {string} sessionId - Current session ID
 * @param {string} businessId - Business record ID
 * @returns {Object} Complete business data
 */
export async function generateBusinessWithAI(userData, sessionId, businessId) {
  console.log('🚀 Starting business generation for session:', sessionId);
  console.log('📋 User data:', { name: userData.name, skills: userData.skills?.substring(0, 50) });
  
  try {
    // Step 1: Analyze opportunity using our core function
    console.log('🔍 Step 1: Analyzing business opportunity...');
    const opportunity = await analyzeOpportunity(userData, sessionId);
    console.log('✅ Opportunity analyzed:', opportunity.businessName);
    
    // Step 2: Launch the business with the analyzed opportunity
    console.log('🚀 Step 2: Launching business...');
    const businessData = await launchBusiness(opportunity, sessionId, businessId);
    console.log('✅ Business launched successfully');
    
    // Note: We don't run growBusiness automatically here because
    // that's part of the ongoing value we provide to customers
    // It's called later in the dashboard flow
    
    return businessData;
  } catch (error) {
    console.error('❌ Error generating business:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    
    // Update session to error state
    try {
      await supabase
        .from('sessions')
        .update({ stage: 'error' })
        .eq('id', sessionId);
      console.log('📝 Session marked as error');
    } catch (updateError) {
      console.error('Failed to update session to error state:', updateError);
    }
    
    throw error;
  }
}