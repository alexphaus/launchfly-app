import { Inngest } from 'inngest';

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'launchfly',
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY
});

// Define event types for better TypeScript support and documentation
export const BusinessEvents = {
  // Trigger events
  GenerationRequested: 'business/generation.requested',
  
  // Stage events
  AnalysisStarted: 'business/analysis.started',
  AnalysisCompleted: 'business/analysis.completed',
  ResearchStarted: 'business/research.started',
  ResearchCompleted: 'business/research.completed',
  BuildingStarted: 'business/building.started',
  BuildingCompleted: 'business/building.completed',
  FinalizingStarted: 'business/finalizing.started',
  GenerationCompleted: 'business/generation.completed',
  
  // Progress update events
  BusinessNameCreated: 'business/progress.name_created',
  BusinessThemeApplied: 'business/progress.theme_applied',
  BusinessProductsCreated: 'business/progress.products_created',
  BusinessTaglineCreated: 'business/progress.tagline_created',
  
  // Growth events
  GrowthStarted: 'business/growth.started',
  GrowthCompleted: 'business/growth.completed',
  
  // Error events
  GenerationFailed: 'business/generation.failed'
};

// Helper function for updating business data progressively
export async function updateBusinessProgress(businessId, partialData, stage = null) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/business/update-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        partialData,
        stage
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update business progress: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating business progress:', error);
    throw error;
  }
}
