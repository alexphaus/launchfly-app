// API endpoint for automated abandoned cart processing
// Run this via cron job every 30 minutes

import { processAbandonedCarts } from '@/lib/abandoned-cart-recovery';

export async function POST(request) {
  try {
    console.log('🛒 Starting abandoned cart processing...');
    
    const result = await processAbandonedCarts();
    
    if (result.success) {
      console.log(`✅ Processed ${result.processed} abandoned carts`);
      return Response.json({ 
        success: true, 
        processed: result.processed,
        message: `Successfully processed ${result.processed} abandoned carts`
      });
    } else {
      console.error('❌ Failed to process abandoned carts:', result.error);
      return Response.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Abandoned cart processing error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return Response.json({ 
    status: 'ok', 
    message: 'Abandoned cart recovery service is running',
    timestamp: new Date().toISOString()
  });
}
