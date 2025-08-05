// src/app/api/debug/session-status/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Debug endpoint to check session and business status
 * Usage: GET /api/debug/session-status?sessionId=your-session-id
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return Response.json(
        { error: 'sessionId parameter required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Debugging session: ${sessionId}`);

    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    const debugInfo = {
      timestamp: new Date().toISOString(),
      sessionId,
      session: {
        found: !sessionError,
        error: sessionError?.message,
        data: session
      },
      business: {
        found: !businessError,
        error: businessError?.message,
        data: business
      },
      environment: {
        inngest_event_key: !!process.env.INNGEST_EVENT_KEY,
        inngest_signing_key: !!process.env.INNGEST_SIGNING_KEY,
        openai_api_key: !!process.env.OPENAI_API_KEY,
        supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_service_key: !!process.env.SUPABASE_SERVICE_KEY
      },
      diagnosis: []
    };

    // Add diagnosis
    if (!session) {
      debugInfo.diagnosis.push("❌ Session not found - this explains why generation isn't starting");
    } else {
      if (session.stage === 'pending') {
        debugInfo.diagnosis.push("🔄 Session is pending - Inngest function should pick this up");
        debugInfo.diagnosis.push("💡 Check if Inngest dev server is running: npx inngest-cli@latest dev");
      } else if (session.stage === 'error') {
        debugInfo.diagnosis.push("❌ Session failed - check error_message field");
      } else {
        debugInfo.diagnosis.push(`✅ Session progressing - current stage: ${session.stage}`);
      }
    }

    if (!business) {
      debugInfo.diagnosis.push("❌ Business record not found - this will cause generation to fail");
    } else {
      debugInfo.diagnosis.push(`📊 Business status: ${business.status}`);
    }

    if (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY) {
      debugInfo.diagnosis.push("⚠️ Missing Inngest environment variables");
    }

    if (!process.env.OPENAI_API_KEY) {
      debugInfo.diagnosis.push("⚠️ Missing OpenAI API key - generation will fail");
    }

    // Check if required tables exist
    try {
      const { data: tableCheck } = await supabase
        .from('ai_activities')
        .select('id')
        .limit(1);
      debugInfo.database = { ai_activities_table: 'exists' };
    } catch (error) {
      debugInfo.database = { 
        ai_activities_table: 'missing',
        error: error.message 
      };
      debugInfo.diagnosis.push("❌ Database migration not applied - run database-migration.sql");
    }

    // Recommendations
    debugInfo.recommendations = [];
    
    if (session?.stage === 'pending') {
      debugInfo.recommendations.push("1. Start Inngest dev server: npx inngest-cli@latest dev");
      debugInfo.recommendations.push("2. Check http://localhost:8288 for Inngest dashboard");
      debugInfo.recommendations.push("3. Look for errors in Next.js console");
    }

    if (!business) {
      debugInfo.recommendations.push("4. Check if business was created properly in database");
    }

    if (debugInfo.database?.ai_activities_table === 'missing') {
      debugInfo.recommendations.push("5. Run database migration SQL in Supabase");
    }

    return Response.json(debugInfo);

  } catch (error) {
    console.error('Debug error:', error);
    return Response.json(
      { 
        error: 'Debug failed',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return Response.json({
    message: 'Use GET method with ?sessionId=your-session-id parameter'
  });
}