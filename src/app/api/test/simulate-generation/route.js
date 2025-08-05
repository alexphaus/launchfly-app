// src/app/api/test/simulate-generation/route.js
import { createClient } from '@supabase/supabase-js';
import { inngest, EVENTS } from '@/lib/inngest/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Test endpoint to simulate business generation and debug issues
 * Usage: POST /api/test/simulate-generation
 */
export async function POST(request) {
  try {
    const { mode = 'full', sessionId: providedSessionId } = await request.json();
    
    const testSessionId = providedSessionId || `test-${Date.now()}`;
    console.log(`🧪 Running simulation for session: ${testSessionId}`);

    const results = {
      timestamp: new Date().toISOString(),
      sessionId: testSessionId,
      mode,
      steps: [],
      errors: [],
      success: true
    };

    // Step 1: Check Environment
    results.steps.push("🔍 Checking environment variables...");
    const envCheck = {
      inngest_event_key: !!process.env.INNGEST_EVENT_KEY,
      inngest_signing_key: !!process.env.INNGEST_SIGNING_KEY,
      openai_api_key: !!process.env.OPENAI_API_KEY,
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_service_key: !!process.env.SUPABASE_SERVICE_KEY
    };

    if (Object.values(envCheck).some(v => !v)) {
      results.errors.push("❌ Missing environment variables");
      results.environment = envCheck;
    } else {
      results.steps.push("✅ Environment variables OK");
    }

    // Step 2: Test Database Connection
    results.steps.push("🔍 Testing database connection...");
    try {
      const { data: testQuery, error: dbError } = await supabase
        .from('sessions')
        .select('id')
        .limit(1);
      
      if (dbError) throw dbError;
      results.steps.push("✅ Database connection OK");
    } catch (error) {
      results.errors.push(`❌ Database error: ${error.message}`);
      results.success = false;
    }

    // Step 3: Check Required Tables
    results.steps.push("🔍 Checking required tables...");
    const tableChecks = {};
    
    for (const table of ['sessions', 'businesses', 'ai_activities', 'prospects']) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        tableChecks[table] = !error;
        if (error && error.code === '42P01') {
          results.errors.push(`❌ Table '${table}' does not exist`);
        }
      } catch (error) {
        tableChecks[table] = false;
        results.errors.push(`❌ Cannot access table '${table}': ${error.message}`);
      }
    }
    
    results.database = { tables: tableChecks };
    
    if (tableChecks.ai_activities) {
      results.steps.push("✅ Required tables exist");
    } else {
      results.errors.push("❌ Database migration required");
      results.success = false;
    }

    // Step 4: Create Test Session (if mode is 'full')
    if (mode === 'full') {
      results.steps.push("🔍 Creating test session...");
      try {
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .upsert({
            id: testSessionId,
            stage: 'pending',
            user_id: 'test-user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        results.steps.push("✅ Test session created");
        results.session = session;
      } catch (error) {
        results.errors.push(`❌ Session creation failed: ${error.message}`);
        results.success = false;
      }

      // Step 5: Create Test Business
      results.steps.push("🔍 Creating test business...");
      try {
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .upsert({
            id: `business-${testSessionId}`,
            session_id: testSessionId,
            status: 'pending',
            name: 'Test Business',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (businessError) throw businessError;
        results.steps.push("✅ Test business created");
        results.business = business;
      } catch (error) {
        results.errors.push(`❌ Business creation failed: ${error.message}`);
        results.success = false;
      }

      // Step 6: Test Inngest Event Sending
      results.steps.push("🔍 Testing Inngest event...");
      try {
        const eventResult = await inngest.send({
          name: EVENTS.BUSINESS_GENERATION_STARTED,
          data: {
            sessionId: testSessionId,
            businessId: `business-${testSessionId}`,
            formData: {
              name: 'Test User',
              email: 'test@example.com',
              skills: 'Testing',
              experience: 'Beginner'
            }
          }
        });

        results.steps.push("✅ Inngest event sent successfully");
        results.inngest = { eventId: eventResult.ids[0] };
      } catch (error) {
        results.errors.push(`❌ Inngest event failed: ${error.message}`);
        results.inngestError = error.message;
        results.success = false;
      }
    }

    // Step 7: Diagnosis and Recommendations
    results.diagnosis = [];
    results.recommendations = [];

    if (results.errors.length === 0) {
      results.diagnosis.push("🎉 All systems operational!");
      if (mode === 'full') {
        results.recommendations.push(`Monitor test session: /dashboard/${testSessionId}`);
        results.recommendations.push("Check Inngest dashboard: http://localhost:8288");
      }
    } else {
      if (results.errors.some(e => e.includes('Database'))) {
        results.diagnosis.push("🔥 Database issues detected");
        results.recommendations.push("Check Supabase connection and credentials");
      }
      
      if (results.errors.some(e => e.includes('Table') && e.includes('exist'))) {
        results.diagnosis.push("🔥 Missing database tables");
        results.recommendations.push("Run database-migration.sql in Supabase");
      }
      
      if (results.errors.some(e => e.includes('Inngest'))) {
        results.diagnosis.push("🔥 Inngest communication issues");
        results.recommendations.push("Check if Inngest dev server is running");
        results.recommendations.push("Verify INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY");
      }
      
      if (results.errors.some(e => e.includes('environment'))) {
        results.diagnosis.push("🔥 Missing environment variables");
        results.recommendations.push("Check .env.local file");
      }
    }

    return Response.json(results);

  } catch (error) {
    console.error('Simulation error:', error);
    return Response.json({
      success: false,
      error: 'Simulation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    message: 'POST to run simulation',
    modes: {
      'quick': 'Check environment and database only',
      'full': 'Full simulation including test session creation and Inngest event'
    },
    usage: {
      quick: 'POST with {"mode": "quick"}',
      full: 'POST with {"mode": "full"}',
      existing: 'POST with {"sessionId": "your-session-id"}'
    }
  });
}