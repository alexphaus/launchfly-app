// src/app/api/cron/cleanup-prospects/route.js
// Cron job to delete expired prospect businesses
// Schedule: Daily at 3 AM UTC

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    
    // Find expired prospect businesses
    const { data: expiredProspects, error: fetchError } = await supabase
      .from('businesses')
      .select('id, name, subdomain, expires_at, created_at')
      .eq('status', 'prospect')
      .lt('expires_at', now);

    if (fetchError) {
      console.error('Error fetching expired prospects:', fetchError);
      throw fetchError;
    }

    if (!expiredProspects || expiredProspects.length === 0) {
      console.log('✅ No expired prospects to clean up');
      return Response.json({ 
        success: true, 
        message: 'No expired prospects found',
        deleted: 0 
      });
    }

    console.log(`🗑️ Found ${expiredProspects.length} expired prospect(s) to clean up`);

    // Delete expired prospects
    const expiredIds = expiredProspects.map(p => p.id);
    
    // First delete related records (sessions, leads, etc.)
    await supabase
      .from('sessions')
      .delete()
      .in('business_id', expiredIds);

    await supabase
      .from('leads')
      .delete()
      .in('business_id', expiredIds);

    // Delete the businesses themselves
    const { error: deleteError } = await supabase
      .from('businesses')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.error('Error deleting expired prospects:', deleteError);
      throw deleteError;
    }

    console.log(`✅ Successfully deleted ${expiredProspects.length} expired prospect(s)`);

    return Response.json({ 
      success: true, 
      deleted: expiredProspects.length,
      deletedIds: expiredIds,
      message: `Cleaned up ${expiredProspects.length} expired prospect business(es)`
    });

  } catch (error) {
    console.error('Prospect cleanup error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}

// Also support POST for manual triggering
export async function POST(request) {
  return GET(request);
}
