#!/usr/bin/env node
// test-real-email-tracking.js
// Send a REAL email to yourself and track real interactions

require('dotenv').config({ path: '.env.local' });

// Check environment
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
  console.error('❌ Missing Resend environment variables!');
  console.error('You need:');
  console.error('  RESEND_API_KEY=re_xxxxxxxxx');
  console.error('  FROM_EMAIL=hello@yourdomain.com\n');
  console.error('Get your API key from: https://resend.com/api-keys');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendRealTestEmail() {
  console.log('📧 Sending REAL Test Email to axpg31@gmail.com\n');
  console.log('This will enable REAL-TIME tracking!\n');

  // Get most recent business
  console.log('1️⃣ Finding your business...');
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!business) {
    console.error('❌ No business found');
    return;
  }

  console.log(`✅ Found: ${business.name}\n`);

  // Add as prospect if not exists
  console.log('2️⃣ Adding you as prospect...');
  await supabase
    .from('prospects')
    .upsert({
      business_id: business.id,
      name: 'Alex',
      email: 'axpg31@gmail.com',
      company: 'Launchfly',
      status: 'discovered',
      industry: 'Technology',
      source: 'real_test'
    }, {
      onConflict: 'business_id,email'
    });

  console.log('✅ Prospect added\n');

  // Send real email
  console.log('3️⃣ Sending REAL email via Resend...');
  
  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #007BFF;">🧪 Test Email - Customer Card Tracking</h2>
      
      <p>Hi Alex!</p>
      
      <p>This is a <strong>real test email</strong> to verify your customer tracking system.</p>
      
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">✅ What This Tests:</h3>
        <ul>
          <li><strong>Email Delivered:</strong> You're reading this ✓</li>
          <li><strong>Email Opened:</strong> Will track when you open this</li>
          <li><strong>Link Clicked:</strong> Click the button below to test</li>
          <li><strong>Email Replied:</strong> Reply to this email to test</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://launchfly.ai/pricing" style="background: #007BFF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          🖱️ Click Here to Test Link Tracking
        </a>
      </div>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>⚡ Real-Time Tracking:</strong>
        <ol>
          <li>Open your dashboard</li>
          <li>Look at "Your Customers" card</li>
          <li>Click the button above</li>
          <li>Watch your dashboard update in real-time!</li>
          <li>Reply to this email to see reply tracking</li>
        </ol>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        This email was sent by your Launchfly test script to verify customer tracking.
      </p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: 'axpg31@gmail.com',
      subject: '🧪 Test: Real-Time Customer Tracking',
      html: emailContent,
      tags: [
        { name: 'type', value: 'test' },
        { name: 'business_id', value: business.id }
      ]
    });

    console.log('✅ Email sent successfully!\n');
    console.log('   Email ID:', result.data?.id || 'N/A');

    // Log the email send
    await supabase
      .from('ai_activities')
      .insert({
        business_id: business.id,
        type: 'email_sent',
        icon: '📧',
        message: 'Sent test email to axpg31@gmail.com',
        details: 'Subject: "🧪 Test: Real-Time Customer Tracking"',
        metadata: {
          recipientEmail: 'axpg31@gmail.com',
          recipientName: 'Alex',
          recipientCompany: 'Launchfly',
          subject: '🧪 Test: Real-Time Customer Tracking',
          emailId: result.data?.id
        }
      });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ REAL EMAIL SENT TO YOUR INBOX!\n');
    console.log('📬 Check your Gmail: axpg31@gmail.com\n');
    console.log('🧪 NOW TEST REAL-TIME TRACKING:\n');
    console.log('1. Open the email in Gmail');
    console.log('   → Dashboard will show: "📬 Email opened"\n');
    console.log('2. Click the blue button in the email');
    console.log('   → Dashboard will show: "🖱️ Clicked link"\n');
    console.log('3. Reply to the email with any message');
    console.log('   → Dashboard will show: "💬 Replied: [your message]"\n');
    console.log('4. Watch your status change:');
    console.log('   Discovered → Contacted → Engaged → Hot Lead 🔥\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANT: For webhooks to work, you need:\n');
    console.log('1. Configure Resend webhook:');
    console.log('   URL: https://your-domain.com/api/webhook/resend');
    console.log('   Events: All email events\n');
    console.log('2. Or test locally with ngrok:');
    console.log('   ngrok http 3000');
    console.log('   Then use the ngrok URL in Resend webhooks\n');
    console.log('Without webhooks, you\'ll only see "Email sent"');
    console.log('With webhooks, you\'ll see real-time updates!\n');

  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    
    if (error.message.includes('API key')) {
      console.error('\n💡 TIP: Check your RESEND_API_KEY in .env.local');
      console.error('Get it from: https://resend.com/api-keys');
    }
  }
}

sendRealTestEmail().catch(console.error);



