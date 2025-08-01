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
  const dashboardUrl = `${process.env.NEXT_PUBLIC_URL}/dashboard/${sessionId}`;
  
  await resend.emails.send({
    from: 'Launchfly <hello@launchfly.ai>',
    to: email,
    subject: `🚀 ${name}, your business is ready to be created!`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚀 Your Business is Ready!</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        
        body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #f4f4f4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        @media screen and (max-width: 600px) {
            .mobile-padding { padding: 20px !important; }
            .mobile-button { width: 100% !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); padding: 40px 20px;">
                            <div style="font-size: 60px; margin-bottom: 20px;">🚀</div>
                            <h1 style="color: #ffffff; font-size: 32px; font-weight: 800; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                Ready to Launch?
                            </h1>
                            <p style="color: #ffffff; font-size: 18px; margin: 0; opacity: 0.95;">
                                Your personalized business is ready to be created!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;" class="mobile-padding">
                            <p style="color: #1A2B48; font-size: 18px; line-height: 1.6; margin: 0 0 25px 0;">
                                <strong>Hi ${name}!</strong> 👋
                            </p>
                            
                            <p style="color: #5A6982; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                Thanks for sharing your business ideas with us. Our AI has analyzed your responses and is ready to build your complete business in just <strong style="color: #007BFF;">30 seconds</strong>!
                            </p>
                            
                            <div style="background-color: #E6F2FF; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
                                <h2 style="color: #007BFF; font-size: 20px; font-weight: 700; margin: 0 0 15px 0;">
                                    ⚡ What You'll Get Instantly:
                                </h2>
                                <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                                    <p style="color: #1A2B48; margin: 8px 0; font-size: 15px;">✅ Professional website built for you</p>
                                    <p style="color: #1A2B48; margin: 8px 0; font-size: 15px;">✅ Products & pricing optimized by AI</p>
                                    <p style="color: #1A2B48; margin: 8px 0; font-size: 15px;">✅ Marketing campaigns that convert</p>
                                    <p style="color: #1A2B48; margin: 8px 0; font-size: 15px;">✅ Customer acquisition strategy</p>
                                </div>
                            </div>
                            
                            <p style="color: #5A6982; font-size: 16px; line-height: 1.6; margin: 0; text-align: center;">
                                <strong style="color: #007BFF;">The AI will create your complete business in just 30 seconds!</strong><br>
                                Click below to watch the magic happen 🪄
                            </p>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td align="center" style="padding: 0 40px 40px 40px;" class="mobile-padding">
                            <table cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%);" class="mobile-button">
                                        <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 18px 36px; font-size: 20px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                                            🚀 Build My Business Now
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Guarantee Section -->
                    <tr>
                        <td style="background-color: #F9FAFB; padding: 30px 40px;" class="mobile-padding">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td width="50" valign="top">
                                        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
                                            💎
                                        </div>
                                    </td>
                                    <td style="padding-left: 15px;">
                                        <p style="color: #1A2B48; font-size: 16px; font-weight: 700; margin: 0 0 8px 0;">
                                            🎯 Your First $1,000 is Guaranteed
                                        </p>
                                        <p style="color: #5A6982; font-size: 14px; line-height: 1.5; margin: 0;">
                                            We're so confident in our AI system that if you don't make your first $1,000 within 90 days, we'll pay you $1,000 ourselves. No risk, all reward.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 30px 40px; border-top: 1px solid #E4E7EB;">
                            <p style="color: #5A6982; font-size: 14px; margin: 0 0 10px 0;">
                                Questions? Reply to this email - we're here to help! 🤝
                            </p>
                            <p style="color: #5A6982; font-size: 12px; margin: 0;">
                                © 2025 Launchfly AI. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `
  });
}