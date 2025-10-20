// src/app/api/webhook/sendgrid/route.js
// SendGrid webhook handler for event tracking and inbound emails

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logActivity, logEmailOpened, logEmailReply, ActivityTypes } from '@/lib/activity-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'SendGrid webhook endpoint active',
    timestamp: new Date().toISOString(),
    env_check: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      sendgrid_key: !!process.env.SENDGRID_API_KEY
    }
  });
}

// Handle SendGrid event webhooks (opens, clicks, bounces, etc.)
export async function POST(request) {
  console.log('=== SENDGRID WEBHOOK RECEIVED ===');
  
  try {
    const body = await request.json();
    console.log('SendGrid webhook payload:', JSON.stringify(body, null, 2));

    // SendGrid sends events as an array
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      await processSendGridEvent(event);
    }

    return NextResponse.json({ success: true, processed: events.length });
    
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 });
  }
}

async function processSendGridEvent(event) {
  const eventType = event.event;
  const email = event.email;
  const businessId = event.business_id || event.customArgs?.business_id;

  console.log(`Processing ${eventType} for ${email}`);

  if (!businessId) {
    console.log('No business ID found in event, skipping...');
    return;
  }

  // Find business info
  const businessInfo = await findBusinessByEmail(email);
  const bid = businessInfo?.businessId || businessId;

  switch (eventType) {
    case 'delivered':
      await handleDelivered(bid, email, event);
      break;
    
    case 'open':
      await handleOpened(bid, email, event);
      break;
    
    case 'click':
      await handleClicked(bid, email, event);
      break;
    
    case 'bounce':
      await handleBounced(bid, email, event);
      break;
    
    case 'dropped':
      await handleDropped(bid, email, event);
      break;
    
    case 'spamreport':
      await handleSpamReport(bid, email, event);
      break;
    
    case 'unsubscribe':
      await handleUnsubscribe(bid, email, event);
      break;
    
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
}

// Helper to find business from email
async function findBusinessByEmail(email) {
  const { data } = await supabase
    .from('ai_activities')
    .select('business_id, metadata')
    .eq('type', 'email_sent')
    .ilike('metadata->>recipientEmail', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data) {
    return { businessId: data.business_id, metadata: data.metadata };
  }

  const { data: prospect } = await supabase
    .from('prospects')
    .select('business_id')
    .eq('email', email)
    .single();

  return prospect ? { businessId: prospect.business_id } : null;
}

async function handleDelivered(businessId, email, event) {
  console.log(`✅ Email delivered to ${email}`);
  await updateProspectStatus(businessId, email, 'contacted');
}

async function handleOpened(businessId, email, event) {
  console.log(`📬 Email opened by ${email}`);
  
  await logEmailOpened(businessId, {
    recipientEmail: email,
    emailId: event.sg_message_id || event.smtp-id,
    openTime: new Date(event.timestamp * 1000).toISOString(),
    userAgent: event.useragent || 'Unknown'
  });
  
  await updateProspectStatus(businessId, email, 'engaged');
}

async function handleClicked(businessId, email, event) {
  console.log(`🖱️ Link clicked by ${email}: ${event.url}`);
  
  await logActivity(businessId, {
    type: 'email_clicked',
    icon: '🖱️',
    message: `${email} clicked a link in your email`,
    details: `Link: ${event.url}`,
    metadata: {
      recipientEmail: email,
      url: event.url,
      clickTime: new Date(event.timestamp * 1000).toISOString(),
      userAgent: event.useragent
    }
  });
  
  await updateProspectStatus(businessId, email, 'engaged');
}

async function handleBounced(businessId, email, event) {
  console.log(`⚠️ Email bounced for ${email}`);
  
  await logActivity(businessId, {
    type: 'email_bounced',
    icon: '⚠️',
    message: `Email to ${email} bounced`,
    details: `Reason: ${event.reason || 'Unknown'}`,
    metadata: {
      recipientEmail: email,
      bounceType: event.type,
      reason: event.reason
    }
  });
  
  await supabase
    .from('prospects')
    .update({ status: 'bounced' })
    .eq('email', email)
    .eq('business_id', businessId);
}

async function handleDropped(businessId, email, event) {
  console.log(`🚫 Email dropped for ${email}`);
  
  await logActivity(businessId, {
    type: 'email_dropped',
    icon: '🚫',
    message: `Email to ${email} was dropped`,
    details: `Reason: ${event.reason || 'Unknown'}`,
    metadata: {
      recipientEmail: email,
      reason: event.reason
    }
  });
}

async function handleSpamReport(businessId, email, event) {
  console.log(`🚫 Spam report from ${email}`);
  
  await logActivity(businessId, {
    type: 'email_complained',
    icon: '🚫',
    message: `${email} marked your email as spam`,
    details: 'Contact automatically unsubscribed',
    metadata: {
      recipientEmail: email
    }
  });
  
  await supabase
    .from('prospects')
    .update({ status: 'unsubscribed' })
    .eq('email', email)
    .eq('business_id', businessId);
}

async function handleUnsubscribe(businessId, email, event) {
  console.log(`👋 Unsubscribe from ${email}`);
  
  await logActivity(businessId, {
    type: 'email_unsubscribed',
    icon: '👋',
    message: `${email} unsubscribed`,
    details: 'Contact removed from campaigns',
    metadata: {
      recipientEmail: email
    }
  });
  
  await supabase
    .from('prospects')
    .update({ status: 'unsubscribed' })
    .eq('email', email)
    .eq('business_id', businessId);
}

async function updateProspectStatus(businessId, email, newStatus) {
  try {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('status')
      .eq('business_id', businessId)
      .ilike('email', email)
      .single();

    if (!prospect) return;

    const statusHierarchy = {
      'discovered': 1,
      'contacted': 2,
      'engaged': 3,
      'converted': 4
    };

    const currentLevel = statusHierarchy[prospect.status] || 0;
    const newLevel = statusHierarchy[newStatus] || 0;

    if (newLevel > currentLevel) {
      await supabase
        .from('prospects')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessId)
        .ilike('email', email);

      console.log(`✅ Updated ${email}: ${prospect.status} → ${newStatus}`);
    }
  } catch (error) {
    console.error('Error updating prospect status:', error);
  }
}



