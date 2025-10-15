// src/app/api/webhook/resend/route.js
import { createClient } from '@supabase/supabase-js';
import { logEmailReply, logEmailOpened, logActivity, ActivityTypes } from '@/lib/activity-logger';
import { inngest } from '@/lib/inngest/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Health check endpoint
export async function GET() {
  return Response.json({ 
    status: 'Resend webhook endpoint is active',
    timestamp: new Date().toISOString(),
    env_check: {
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
      inngest_event_key: !!process.env.INNGEST_EVENT_KEY
    }
  });
}

export async function POST(request) {
  console.log('=== RESEND WEBHOOK RECEIVED ===');
  
  try {
    const body = await request.json();
    console.log('Webhook payload:', JSON.stringify(body, null, 2));

    const eventType = body.type;
    const eventData = body.data;

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'email.sent':
        return await handleEmailSent(eventData);
      
      case 'email.delivered':
        return await handleEmailDelivered(eventData);
      
      case 'email.opened':
        return await handleEmailOpened(eventData);
      
      case 'email.clicked':
        return await handleEmailClicked(eventData);
      
      case 'email.replied':
      case 'email.received':
        return await handleEmailReplied(eventData);
      
      case 'email.bounced':
        return await handleEmailBounced(eventData);
      
      case 'email.complained':
        return await handleEmailComplaint(eventData);
      
      default:
        console.log('Unhandled webhook type:', eventType);
        return Response.json({ success: true, message: 'Webhook received but not processed' });
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 });
  }
}

// Helper function to find business from email
async function findBusinessByEmail(email) {
  // Try to find from activities first
  const { data: emailRecord } = await supabase
    .from('ai_activities')
    .select('business_id, metadata')
    .eq('type', 'email_sent')
    .ilike('metadata->>recipientEmail', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (emailRecord) {
    return { businessId: emailRecord.business_id, metadata: emailRecord.metadata };
  }

  // Try to find from prospects
  const { data: prospectRecord } = await supabase
    .from('prospects')
    .select('business_id')
    .eq('email', email)
    .limit(1)
    .single();

  if (prospectRecord) {
    return { businessId: prospectRecord.business_id, metadata: null };
  }

  return null;
}

// Handler for email.sent
async function handleEmailSent(data) {
  console.log('📤 Email sent:', data.email_id);
  return Response.json({ success: true, message: 'Email sent event logged' });
}

// Handler for email.delivered
async function handleEmailDelivered(data) {
  console.log('✅ Email delivered:', data.email_id);
  
  const recipientEmail = data.to || data.email;
  const businessInfo = await findBusinessByEmail(recipientEmail);
  
  if (businessInfo) {
    await updateProspectStatus(businessInfo.businessId, recipientEmail, 'contacted');
  }
  
  return Response.json({ success: true, message: 'Email delivery logged' });
}

// Handler for email.opened
async function handleEmailOpened(data) {
  console.log('📬 Email opened:', data.email_id);
  
  const recipientEmail = data.to || data.email;
  const businessInfo = await findBusinessByEmail(recipientEmail);
  
  if (businessInfo) {
    await logEmailOpened(businessInfo.businessId, {
      recipientEmail: recipientEmail,
      emailId: data.email_id,
      openTime: new Date().toISOString(),
      userAgent: data.user_agent || 'Unknown'
    });
    
    // Update prospect status to "Engaged" when they open the email
    await updateProspectStatus(businessInfo.businessId, recipientEmail, 'engaged');
  }
  
  return Response.json({ success: true, message: 'Email open tracked' });
}

// Handler for email.clicked
async function handleEmailClicked(data) {
  console.log('🖱️ Email link clicked:', data.email_id);
  
  const recipientEmail = data.to || data.email;
  const businessInfo = await findBusinessByEmail(recipientEmail);
  
  if (businessInfo) {
    await logActivity(businessInfo.businessId, {
      type: 'email_clicked',
      icon: '🖱️',
      message: `${recipientEmail} clicked a link in your email`,
      details: `Link: ${data.url || 'Unknown'}`,
      metadata: {
        recipientEmail: recipientEmail,
        emailId: data.email_id,
        url: data.url,
        clickTime: new Date().toISOString()
      }
    });
    
    // High engagement - update to engaged status
    await updateProspectStatus(businessInfo.businessId, recipientEmail, 'engaged');
  }
  
  return Response.json({ success: true, message: 'Email click tracked' });
}

// Handler for email.replied (existing logic)
async function handleEmailReplied(data) {
  const replyEmail = data.from || data.email;
  const replyText = data.text || data.html || '';
  const subject = data.subject || '';
  const originalEmailId = data.in_reply_to || data.message_id;
  
  console.log('Processing email reply:', {
    from: replyEmail,
    subject: subject,
    originalEmailId: originalEmailId,
    textLength: replyText.length
  });

  const businessInfo = await findBusinessByEmail(replyEmail);

  if (!businessInfo) {
    // For testing - if this is axpg31@gmail.com, create a test scenario
    if (replyEmail === 'axpg31@gmail.com') {
      console.log('Test email detected - using test business scenario');
      
      const { data: recentBusiness } = await supabase
        .from('businesses')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentBusiness) {
        await handleEmailReply(recentBusiness.id, replyEmail, replyText, subject, originalEmailId);
        return Response.json({ success: true, message: 'Test email reply processed' });
      }
    }
    
    console.log('Could not find business for email:', replyEmail);
    return Response.json({ error: 'No business found for this email' }, { status: 404 });
  }

  await handleEmailReply(businessInfo.businessId, replyEmail, replyText, subject, originalEmailId);
  return Response.json({ success: true, message: 'Email reply processed' });
}

// Handler for email.bounced
async function handleEmailBounced(data) {
  console.log('⚠️ Email bounced:', data.email_id);
  
  const recipientEmail = data.to || data.email;
  const businessInfo = await findBusinessByEmail(recipientEmail);
  
  if (businessInfo) {
    await logActivity(businessInfo.businessId, {
      type: 'email_bounced',
      icon: '⚠️',
      message: `Email to ${recipientEmail} bounced`,
      details: `Reason: ${data.bounce_type || 'Unknown'}`,
      metadata: {
        recipientEmail: recipientEmail,
        emailId: data.email_id,
        bounceType: data.bounce_type,
        bounceReason: data.reason
      }
    });
    
    // Mark prospect as bounced
    await supabase
      .from('prospects')
      .update({ status: 'bounced' })
      .eq('email', recipientEmail)
      .eq('business_id', businessInfo.businessId);
  }
  
  return Response.json({ success: true, message: 'Email bounce logged' });
}

// Handler for email.complained
async function handleEmailComplaint(data) {
  console.log('🚫 Email complaint:', data.email_id);
  
  const recipientEmail = data.to || data.email;
  const businessInfo = await findBusinessByEmail(recipientEmail);
  
  if (businessInfo) {
    await logActivity(businessInfo.businessId, {
      type: 'email_complained',
      icon: '🚫',
      message: `${recipientEmail} marked your email as spam`,
      details: 'This contact has been automatically unsubscribed',
      metadata: {
        recipientEmail: recipientEmail,
        emailId: data.email_id,
        complaintTime: new Date().toISOString()
      }
    });
    
    // Mark prospect as unsubscribed
    await supabase
      .from('prospects')
      .update({ status: 'unsubscribed' })
      .eq('email', recipientEmail)
      .eq('business_id', businessInfo.businessId);
  }
  
  return Response.json({ success: true, message: 'Email complaint logged' });
}

// Update prospect status automatically
async function updateProspectStatus(businessId, email, newStatus) {
  try {
    // Get current prospect
    const { data: prospect } = await supabase
      .from('prospects')
      .select('status')
      .eq('business_id', businessId)
      .eq('email', email)
      .single();

    if (!prospect) return;

    // Status progression hierarchy: contacted < engaged < converted
    const statusHierarchy = {
      'discovered': 1,
      'contacted': 2,
      'engaged': 3,
      'converted': 4
    };

    const currentLevel = statusHierarchy[prospect.status] || 0;
    const newLevel = statusHierarchy[newStatus] || 0;

    // Only update if new status is higher
    if (newLevel > currentLevel) {
      await supabase
        .from('prospects')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessId)
        .eq('email', email);

      console.log(`✅ Updated ${email} status: ${prospect.status} → ${newStatus}`);
    }
  } catch (error) {
    console.error('Error updating prospect status:', error);
  }
}

async function handleEmailReply(businessId, replyEmail, replyText, subject, originalEmailId) {
  console.log('Handling email reply for business:', businessId);
  
  // Analyze reply sentiment (simple keyword-based)
  const positiveKeywords = ['yes', 'interested', 'tell me more', 'sounds good', 'lets talk', 'schedule', 'meeting', 'call'];
  const negativeKeywords = ['no', 'not interested', 'remove', 'unsubscribe', 'stop', 'dont contact'];
  
  const lowerText = replyText.toLowerCase();
  const isPositive = positiveKeywords.some(keyword => lowerText.includes(keyword));
  const isNegative = negativeKeywords.some(keyword => lowerText.includes(keyword));
  
  let sentiment = 'neutral';
  if (isPositive) sentiment = 'positive';
  if (isNegative) sentiment = 'negative';

  // Create preview text (first 100 chars)
  const previewText = replyText.substring(0, 100) + (replyText.length > 100 ? '...' : '');

  const replyData = {
    recipientEmail: replyEmail,
    originalEmailId: originalEmailId,
    replyText: replyText,
    subject: subject,
    sentiment: sentiment,
    isPositive: isPositive,
    previewText: previewText
  };

  // Log the email reply activity
  await logEmailReply(businessId, replyData);

  // Trigger Inngest event for further processing
  await inngest.send({
    name: 'customer/email.response',
    data: {
      businessId: businessId,
      emailData: {
        emailId: originalEmailId
      },
      responseData: {
        fromEmail: replyEmail,
        text: replyText,
        subject: subject,
        sentiment: sentiment,
        isPositive: isPositive
      }
    }
  });

  console.log('Email reply processed successfully for business:', businessId);
}
