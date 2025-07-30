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
  console.log('Starting business generation for session:', sessionId);
  
  try {
    // Step 1: Analyze opportunity using our core function
    console.log('Analyzing business opportunity...');
    const opportunity = await analyzeOpportunity(userData, sessionId);
    
    // Step 2: Launch the business with the analyzed opportunity
    console.log('Launching business...');
    const businessData = await launchBusiness(opportunity, sessionId, businessId);
    
    // Note: We don't run growBusiness automatically here because
    // that's part of the ongoing value we provide to customers
    // It's called later in the dashboard flow
    
    return businessData;
  } catch (error) {
    console.error('Error generating business:', error);
    
    // Update session to error state
    await supabase
      .from('sessions')
      .update({ stage: 'error' })
      .eq('id', sessionId);
    
    throw error;
  }
}