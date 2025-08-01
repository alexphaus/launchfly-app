import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return Response.json({ error: 'sessionId parameter is required' }, { status: 400 });
  }
  
  try {
    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) {
      return Response.json({ error: 'Session not found', details: sessionError }, { status: 404 });
    }
    
    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    // Calculate time since creation
    const createdAt = new Date(session.created_at);
    const now = new Date();
    const minutesElapsed = Math.round((now - createdAt) / (1000 * 60));
    
    // Determine status
    let status = 'unknown';
    let message = '';
    
    if (session.stage === 'complete') {
      status = 'completed';
      message = 'Business generation completed successfully';
    } else if (session.stage === 'error') {
      status = 'failed';
      message = session.error_message || 'Business generation failed';
    } else if (minutesElapsed > 3) {
      status = 'stuck';
      message = `Generation has been running for ${minutesElapsed} minutes. This might indicate an issue.`;
    } else {
      status = 'processing';
      message = `Currently ${session.stage} (${session.progress}% complete)`;
    }
    
    return Response.json({
      sessionId,
      status,
      message,
      session: {
        stage: session.stage,
        progress: session.progress,
        completedSteps: session.completed_steps,
        createdAt: session.created_at,
        minutesElapsed
      },
      business: business ? {
        id: business.id,
        name: business.name,
        subdomain: business.subdomain,
        status: business.status,
        hasBusinessData: !!business.business_data
      } : null,
      recommendations: getRecommendations(session, business, minutesElapsed)
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function getRecommendations(session, business, minutesElapsed) {
  const recommendations = [];
  
  if (session.stage === 'error') {
    recommendations.push('Try refreshing the page or starting a new session');
    recommendations.push('Check if there are any network connectivity issues');
  } else if (minutesElapsed > 3) {
    recommendations.push('The generation is taking longer than expected');
    recommendations.push('Consider refreshing the page to restart the process');
    if (session.stage === 'building') {
      recommendations.push('The system may be experiencing high load. OpenAI API calls can sometimes take longer.');
    }
  } else if (session.stage === 'pending') {
    recommendations.push('The generation should start automatically. If not, try refreshing the page.');
  }
  
  return recommendations;
}
