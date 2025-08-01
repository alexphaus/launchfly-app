import { createClient } from '@supabase/supabase-js';
import { analyzeOpportunity, launchBusiness } from '@/core';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    console.log('=== STARTING TEST BUSINESS GENERATION ===');
    
    // Create a test session
    const testSessionId = `test-${Date.now()}`;
    console.log('Test session ID:', testSessionId);
    
    // Insert test session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert([{
        id: testSessionId,
        stage: 'pending',
        progress: 0
      }])
      .select()
      .single();
      
    if (sessionError) {
      console.error('Session creation error:', sessionError);
      throw sessionError;
    }
    
    console.log('Test session created:', session);
    
    // Get an existing user ID from the database or skip the foreign key
    const { data: existingUsers } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    const userId = existingUsers?.[0]?.id || null;
    console.log('Using user ID:', userId);
    
    if (!userId) {
      console.log('No existing users found, creating test without user_id constraint');
    }
    
    // Create test business
    const businessInsertData = {
      name: 'Test Business',
      subdomain: `test-${Date.now()}`,
      session_id: testSessionId,
      form_data: {
        name: 'Test User',
        skills: 'Web development and marketing',
        businessType: 'Digital Services',
        goal: 'Make $5000/month',
        preferences: 'Online business'
      },
      status: 'pending'
    };
    
    // Only add user_id if we have one
    if (userId) {
      businessInsertData.user_id = userId;
    }
    
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert([businessInsertData])
      .select()
      .single();
      
    if (businessError) {
      console.error('Business creation error:', businessError);
      throw businessError;
    }
    
    console.log('Test business created:', business);
    
    // Test the analyze opportunity step
    console.log('=== TESTING ANALYZE OPPORTUNITY ===');
    const opportunity = await analyzeOpportunity(business.form_data, testSessionId);
    console.log('Opportunity analysis completed:', !!opportunity);
    
    // Test the launch business step
    console.log('=== TESTING LAUNCH BUSINESS ===');
    const businessData = await launchBusiness(opportunity, testSessionId, business.id);
    console.log('Business launch completed:', !!businessData);
    
    console.log('=== TEST COMPLETED SUCCESSFULLY ===');
    
    return Response.json({ 
      success: true, 
      sessionId: testSessionId,
      businessId: business.id,
      opportunity,
      businessData
    });
    
  } catch (error) {
    console.error('=== TEST FAILED ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
