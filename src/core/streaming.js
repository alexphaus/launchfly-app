/**
 * Real-time content streaming for business generation
 * 
 * This module adds streaming capabilities to the business generation process,
 * allowing users to see content as it's being created by the OpenAI API.
 */

import { createClient } from '@supabase/supabase-js';

// Create Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Updates business data with partial content as it's being generated
 * 
 * @param {string} businessId - Business record ID
 * @param {string} contentType - Type of content being updated ('website', 'products', 'marketing')
 * @param {string} partialContent - The partial content generated so far
 * @param {Object} existingData - The existing business data to update
 * @returns {Promise<void>}
 */
export async function updateWithPartialContent(businessId, contentType, partialContent, existingData = {}) {
  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();
      
    const currentData = business?.business_data || existingData || {};
    
    // Create a structured update based on the content type
    const partialUpdate = {
      ...currentData,
      streaming: {
        ...currentData.streaming,
        [contentType]: {
          content: partialContent,
          lastUpdated: new Date().toISOString()
        }
      }
    };

    // Try to parse JSON content if possible
    if (partialContent.trim().startsWith('{') && partialContent.trim().endsWith('}')) {
      try {
        const jsonContent = JSON.parse(partialContent);
        
        // Depending on content type, store the parsed JSON in the appropriate field
        if (contentType === 'website') {
          partialUpdate.partialWebsite = jsonContent;
        } else if (contentType === 'products') {
          partialUpdate.partialProducts = jsonContent.products;
        } else if (contentType === 'marketing') {
          partialUpdate.partialMarketing = jsonContent;
        }
      } catch (e) {
        // Not valid JSON yet, that's okay - we keep the raw text
        console.log('Partial content not yet valid JSON:', e.message);
      }
    }
    
    // Update the business record with the partial content
    await supabase
      .from('businesses')
      .update({
        business_data: partialUpdate
      })
      .eq('id', businessId);
      
  } catch (error) {
    console.error('Error updating business with partial content:', error);
  }
}

/**
 * Process a streaming OpenAI response and update business data in real-time
 * 
 * @param {Object} stream - The OpenAI response stream
 * @param {string} businessId - Business record ID
 * @param {string} contentType - Type of content being generated
 * @param {Object} existingData - Existing business data
 * @returns {Promise<string>} The complete generated content
 */
export async function processStreamingResponse(stream, businessId, contentType, existingData = {}) {
  let completeContent = '';
  let updateInterval = null;
  let bufferContent = '';
  
  // Start an interval for updates to avoid overwhelming the database
  updateInterval = setInterval(async () => {
    if (bufferContent) {
      await updateWithPartialContent(businessId, contentType, completeContent, existingData);
      bufferContent = '';
    }
  }, 500); // Update every 500ms

  try {
    for await (const chunk of stream) {
      // Get the text fragment from the chunk
      const fragmentText = chunk.choices[0]?.delta?.content || '';
      completeContent += fragmentText;
      bufferContent += fragmentText;
      
      // If we have significant amount of new content, update immediately
      if (bufferContent.length > 100) {
        await updateWithPartialContent(businessId, contentType, completeContent, existingData);
        bufferContent = '';
      }
    }
    
    // Final update with complete content
    if (completeContent) {
      await updateWithPartialContent(businessId, contentType, completeContent, existingData);
    }
    
    return completeContent;
  } finally {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  }
}
