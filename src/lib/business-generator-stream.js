// lib/business-generator-stream.js
import { createClient } from '@supabase/supabase-js';
import { analyzeOpportunity } from '../core/analyze';
import { launchBusinessStream } from '../core/launch-stream';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Generate a complete business with real-time streaming updates
 * Shows content being built piece by piece as AI generates it
 * 
 * @param {Object} userData - User information from the form 
 * @param {string} sessionId - Current session ID
 * @param {string} businessId - Business record ID
 * @param {Function} onUpdate - Callback for real-time updates
 * @returns {Object} Complete business data
 */
export async function generateBusinessWithAIStream(userData, sessionId, businessId, onUpdate) {
  console.log('Starting streaming business generation for session:', sessionId);
  
  try {
    // Step 1: Analyze opportunity
    onUpdate({
      type: 'stage',
      stage: 'analyzing',
      message: 'Analyzing your skills and market opportunities...'
    });

    await supabase
      .from('sessions')
      .update({ stage: 'analyzing' })
      .eq('id', sessionId);

    const opportunity = await analyzeOpportunity(userData, sessionId);
    
    onUpdate({
      type: 'content',
      section: 'analysis',
      data: {
        businessName: opportunity.businessName,
        niche: opportunity.niche,
        solution: opportunity.solution
      }
    });

    // Step 2: Research phase
    onUpdate({
      type: 'stage',
      stage: 'researching',
      message: 'Researching your target market and competitors...'
    });

    await supabase
      .from('sessions')
      .update({ stage: 'researching' })
      .eq('id', sessionId);

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 3: Building phase with streaming
    onUpdate({
      type: 'stage',
      stage: 'building',
      message: 'Building your website and products...'
    });

    await supabase
      .from('sessions')
      .update({ stage: 'building' })
      .eq('id', sessionId);

    // Launch business with streaming updates
    const businessData = await launchBusinessStream(opportunity, sessionId, businessId, onUpdate);
    
    // Step 4: Finalizing
    onUpdate({
      type: 'stage',
      stage: 'finalizing',
      message: 'Finalizing your business setup...'
    });

    await supabase
      .from('sessions')
      .update({ stage: 'finalizing' })
      .eq('id', sessionId);

    // Save final business data
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain ? businessData.domain.replace('.com', '').toLowerCase() : `business-${Date.now()}`,
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);

    return businessData;
  } catch (error) {
    console.error('Error in streaming generation:', error);
    
    onUpdate({
      type: 'error',
      message: error.message
    });
    
    await supabase
      .from('sessions')
      .update({ stage: 'error' })
      .eq('id', sessionId);
    
    throw error;
  }
}
