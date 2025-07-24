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
    console.log('Received Tally webhook:', formData);
    
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

    // Extract session ID from hidden field or generate new one
    const sessionId = formData.data.fields.find(f => f.label === "sessionID")?.value || nanoid();
    console.log('Using session ID:', sessionId);
    
    // Create or get user
    let userId;
    
    // Try to create new user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
      user_metadata: {
        full_name: userData.name
      }
    });

    if (authError && authError.message !== 'User already registered') {
      throw authError;
    }

    if (authData?.user) {
      userId = authData.user.id;
    } else {
      // User exists, get their ID
      const { data: existingUser, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email)
        .single();
        
      if (error || !existingUser) {
        throw new Error(`User not found: ${userData.email}`);
      }
      
      userId = existingUser.id;
    }

    // Create business record
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: 'Generating Your Business...', 
        subdomain: `business-${nanoid(8).toLowerCase()}`,
        status: 'generating',
        form_data: userData,
        session_id: sessionId
      })
      .select()
      .single();

    if (businessError) throw businessError;

    // Create session record
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        business_id: business.id,
        stage: 'analyzing',
        progress: 25
      });

    if (sessionError) throw sessionError;

    // Send immediate dashboard email
    await sendDashboardEmail(userData.email, userData.name, sessionId);
    
    // Start business generation in background
    generateBusinessInBackground(business.id, sessionId, userData);
    
    // Return redirect URL for Tally
    return Response.json({ success: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
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
    subject: `🚀 ${name}, your business is being created RIGHT NOW!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #5D5FEF;">Your AI is Building Your Business!</h1>
        
        <p style="font-size: 18px; line-height: 1.6;">
          Hi ${name},<br><br>
          Your personalized business is being generated as we speak!
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #5D5FEF 0%, #00D4FF 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block;">
            Watch Your Business Come to Life →
          </a>
        </div>
        
        <p style="color: #666;">
          <strong>Tip:</strong> Most users who complete setup in the first hour make their first sale within 48 hours!
        </p>
      </div>
    `
  });
}

async function generateBusinessInBackground(businessId, sessionId, userData) {
  const { generateBusinessWithAI } = await import('@/lib/business-generator');
  
  try {
    const businessData = await generateBusinessWithAI(userData, sessionId, businessId);
    
    // Update business with generated data
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain.replace('.com', '').toLowerCase(),
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);

    // Update session to complete
    const { data, error } = await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
    } else {
      console.log('Session updated:', data);
    }

    // Log analytics event
    await supabase
      .from('analytics')
      .insert({
        business_id: businessId,
        event_type: 'business_generated',
        event_data: { generation_time: Date.now() }
      });

  } catch (error) {
    console.error('Generation error:', error);
    
    await supabase
      .from('businesses')
      .update({ status: 'failed' })
      .eq('id', businessId);
      
    await supabase
      .from('sessions')
      .update({ stage: 'error' })
      .eq('id', sessionId);
  }
}
