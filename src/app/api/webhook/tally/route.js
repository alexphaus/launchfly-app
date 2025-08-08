// src/app/api/webhook/tally/route.js
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

    // Generate session ID
    const sessionId = formData.data.fields.find(f => f.label === "sessionID")?.value || nanoid();
    console.log('Using session ID:', sessionId);
    
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

    // Ensure profiles row exists & store plan at user level as well
    const planTier = (userData.plan || 'Starter').toLowerCase();
    const { error: profileUpsertError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userData.email,
        full_name: userData.name || 'User',
        plan: planTier === 'starter' ? 'starter' : planTier === 'pro' ? 'pro' : 'scale'
      }, { onConflict: 'id' });
    if (profileUpsertError) {
      console.warn('Profile upsert warning:', profileUpsertError.message);
    }

    // Create business record
  // Map rev share based on plan tier (Starter 20%, Pro 10%, Scale 5%)
  const revShareMap = { starter: 20, pro: 10, scale: 5 };
  const revSharePercent = revShareMap[planTier] ?? 20;

  const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: 'Pending Generation', 
        subdomain: `business-${nanoid(8).toLowerCase()}`,
        status: 'pending', // Not 'generating' yet
        form_data: userData,
    session_id: sessionId,
    guarantee_start_at: new Date().toISOString(),
    plan_tier: planTier,
    rev_share_percent: revSharePercent
      })
      .select()
      .single();

    if (businessError) throw businessError;

    // Create session record with pending state
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        business_id: business.id,
        stage: 'pending', // Will trigger generation from dashboard
        progress: 0
      });

    if (sessionError) throw sessionError;

    // Send immediate dashboard email
    await sendDashboardEmail(userData.email, userData.name, sessionId);
    
    // Just return success - no background generation
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
  const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${sessionId}`;
  
  await resend.emails.send({
    from: 'Launchfly <hello@launchfly.ai>',
    to: email,
    subject: `🚀 ${name}, watch your business being built in real-time!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #5D5FEF;">Your Business Dashboard is Ready!</h1>
        
        <p style="font-size: 18px; line-height: 1.6;">
          Hi ${name},<br><br>
          Your dashboard is ready! Click below to watch your AI-powered business being built in real-time.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #5D5FEF 0%, #00D4FF 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block;">
            Watch Your Business Being Built →
          </a>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <h3 style="color: #333; margin: 0 0 12px 0;">✨ What you'll see:</h3>
          <ul style="color: #666; margin: 0; padding-left: 20px;">
            <li>AI analyzing your skills and opportunities</li>
            <li>Real-time website creation and updates</li>
            <li>Live progress as your business takes shape</li>
            <li>Your custom business website going live</li>
          </ul>
        </div>
        
        <p style="color: #666;">
          <strong>Note:</strong> The entire process takes about 2-3 minutes. You can watch every step happen live in your dashboard!
        </p>
      </div>
    `
  });
}