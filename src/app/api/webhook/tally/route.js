// app/api/webhook/tally/route.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const formData = await request.json();
    console.log('🎯 Received Tally webhook:', {
      timestamp: new Date().toISOString(),
      fields: formData.data?.fields?.length || 0
    });
    
    // Extract user data from Tally form
    const userData = {
      name: formData.data.fields.find(f => f.label === "Name")?.value,
      email: formData.data.fields.find(f => f.label === "Email")?.value,
      skills: formData.data.fields.find(f => f.label === "What are your main skills or interests?")?.value,
      businessType: formData.data.fields.find(f => f.label === "What type of business are you most interested in?")?.value,
      goal: formData.data.fields.find(f => f.label === "What's your business goal?")?.value,
      preferences: formData.data.fields.find(f => f.label === "Any special preferences or ideas you have?")?.value,
      plan: formData.data.fields.find(f => f.label === "plan")?.value || "Starter"
    };

    console.log('📋 Extracted user data:', {
      name: userData.name,
      email: userData.email,
      hasSkills: !!userData.skills,
      businessType: userData.businessType
    });

    // Generate session ID
    const sessionId = formData.data.fields.find(f => f.label === "sessionID")?.value || nanoid();
    console.log('🔑 Using session ID:', sessionId);
    
    // Create or get user
    let userId;
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
      user_metadata: {
        full_name: userData.name
      }
    });

    if (authError && authError.message !== 'User already registered') {
      console.error('Auth error:', authError);
      throw authError;
    }

    if (authData?.user) {
      userId = authData.user.id;
      console.log('Created new user:', userId);
      
      // Create profile record for new user
      await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userData.email,
          full_name: userData.name,
          plan: userData.plan || 'trial'
        });
    } else {
      // User exists, get their ID from auth
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        throw listError;
      }
      
      const existingUser = existingUsers.users.find(user => user.email === userData.email);
      
      if (!existingUser) {
        throw new Error(`User not found in auth: ${userData.email}`);
      }
      
      userId = existingUser.id;
      console.log('Found existing user:', userId);
    }

    // Create business record
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: 'Pending Generation', 
        subdomain: `business-${nanoid(8).toLowerCase()}`,
        status: 'pending', // Not 'generating' yet
        form_data: userData,
        session_id: sessionId
      })
      .select()
      .single();

    if (businessError) {
      console.error('❌ Business creation error:', businessError);
      throw businessError;
    }
    console.log('✅ Business created:', business.id);

    // Create session record with pending state
    console.log('📊 Creating session record...');
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        business_id: business.id,
        stage: 'pending', // Will trigger generation from dashboard
        progress: 0
      });

    if (sessionError) {
      console.error('❌ Session creation error:', sessionError);
      throw sessionError;
    }
    console.log('✅ Session created');

    // Send immediate dashboard email
    console.log('📧 Sending dashboard email...');
    await sendDashboardEmail(userData.email, userData.name, sessionId);
    console.log('✅ Dashboard email sent');
    
    // Start background business generation process
    console.log('🚀 Starting background business generation...');
    generateBusinessAsync(sessionId, userData).catch(error => {
      console.error('❌ Background generation error:', error);
    });
    
    console.log('🎉 Tally webhook completed successfully');
    return Response.json({ success: true });
    
  } catch (error) {
    console.error('❌ Tally webhook error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function sendDashboardEmail(email, name, sessionId) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_URL}/dashboard/${sessionId}`;
  
  await resend.emails.send({
    from: 'Launchfly <hello@launchfly.ai>',
    to: email,
    subject: `🚀 ${name}, your business is ready to be created!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #5D5FEF;">Click to Build Your Business!</h1>
        
        <p style="font-size: 18px; line-height: 1.6;">
          Hi ${name},<br><br>
          Your personalized business is ready to be generated!
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #5D5FEF 0%, #00D4FF 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block;">
            Start Building Your Business →
          </a>
        </div>
        
        <p style="color: #666;">
          <strong>Tip:</strong> The AI will create your complete business in just 30 seconds!
        </p>
      </div>
    `
  });
}

async function generateBusinessAsync(sessionId, userData) {
  console.log(`🔄 Background generation started for session: ${sessionId}`);
  
  try {
    // Update session to analyzing stage
    await supabase
      .from('sessions')
      .update({ 
        stage: 'analyzing',
        progress: 10,
        user_email: userData.email,
        user_name: userData.name,
        skills: userData.skills
      })
      .eq('id', sessionId);
    
    console.log('🔍 Starting simplified business analysis...');
    
    // Simulate analysis time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update progress
    await supabase
      .from('sessions')
      .update({ 
        stage: 'launching',
        progress: 50
      })
      .eq('id', sessionId);
    
    console.log('🚀 Starting simplified business launch...');
    
    // Simulate launch time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Update business record with basic data
    await supabase
      .from('businesses')
      .update({
        name: `${userData.name}'s Business`,
        description: `A business based on ${userData.skills}`,
        stage: 'launched'
      })
      .eq('session_id', sessionId);
    
    // Update session to complete
    await supabase
      .from('sessions')
      .update({ 
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId);
    
    console.log(`🎉 Background generation completed for session: ${sessionId}`);
    
  } catch (error) {
    console.error(`❌ Background generation failed for session ${sessionId}:`, error);
    
    // Update session to error state
    await supabase
      .from('sessions')
      .update({ 
        stage: 'error',
        progress: 50
      })
      .eq('id', sessionId);
  }
}