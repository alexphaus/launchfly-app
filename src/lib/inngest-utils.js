import { inngest } from "./inngest";

/**
 * Utility functions for common Inngest patterns
 */

/**
 * Trigger business generation with proper error handling
 */
export async function triggerBusinessGeneration(sessionId, businessId, formData) {
  try {
    console.log('=== INNGEST UTILS: Triggering business generation ===');
    console.log('Session ID:', sessionId);
    console.log('Business ID:', businessId);
    
    const eventData = {
      name: "business/generation.requested",
      data: {
        sessionId,
        businessId,
        formData,
        timestamp: new Date().toISOString()
      },
    };
    
    console.log('Sending Inngest event:', eventData);
    const event = await inngest.send(eventData);
    
    console.log('Inngest event sent successfully:', event);
    return { success: true, eventId: event.ids[0] };
  } catch (error) {
    console.error('=== INNGEST UTILS: Failed to trigger business generation ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Trigger error handler
    try {
      await inngest.send({
        name: "business/generation.failed",
        data: {
          sessionId,
          businessId,
          error: {
            message: error.message,
            stack: error.stack
          },
          originalEventData: { sessionId, businessId, formData }
        }
      });
    } catch (errorHandlerError) {
      console.error('Failed to trigger error handler:', errorHandlerError);
    }
    
    throw error;
  }
}

/**
 * Trigger business validation
 */
export async function triggerBusinessValidation(businessId, businessData) {
  try {
    const event = await inngest.send({
      name: "business/validation.requested",
      data: {
        businessId,
        businessData,
        timestamp: new Date().toISOString()
      },
    });
    
    return { success: true, eventId: event.ids[0] };
  } catch (error) {
    console.error('Failed to trigger business validation:', error);
    throw error;
  }
}

/**
 * Trigger business enhancement
 */
export async function triggerBusinessEnhancement(businessId, enhancementType) {
  try {
    const event = await inngest.send({
      name: "business/enhancement.requested", 
      data: {
        businessId,
        enhancementType,
        timestamp: new Date().toISOString()
      },
    });
    
    return { success: true, eventId: event.ids[0] };
  } catch (error) {
    console.error('Failed to trigger business enhancement:', error);
    throw error;
  }
}

/**
 * Check the status of a running Inngest function
 */
export async function checkFunctionStatus(eventId) {
  // Note: This would require Inngest SDK features for status checking
  // For now, you can check the database or use Inngest dashboard
  console.log(`Checking status for event: ${eventId}`);
  return { status: 'running' }; // Placeholder
}

/**
 * Batch trigger multiple events (useful for bulk operations)
 */
export async function triggerBatchOperations(operations) {
  try {
    const events = operations.map(op => ({
      name: op.eventName,
      data: {
        ...op.data,
        timestamp: new Date().toISOString()
      }
    }));
    
    const result = await inngest.send(events);
    return { success: true, eventIds: result.ids };
  } catch (error) {
    console.error('Failed to trigger batch operations:', error);
    throw error;
  }
}
