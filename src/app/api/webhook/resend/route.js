// src/app/api/webhook/resend/route.js
import { createClient } from '@supabase/supabase-js';
import { logEmailReply } from '@/lib/activity-logger';
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

    // Resend webhook events for email replies
    if (body.type === 'email.replied' || body.type === 'email.received') {
      const { data } = body;
      
      // Extract reply information
      const replyEmail = data.from;
      const replyText = data.text || data.html || '';
      const subject = data.subject || '';
      const originalEmailId = data.in_reply_to || data.message_id;
      
      console.log('Processing email reply:', {
        from: replyEmail,
        subject: subject,
        originalEmailId: originalEmailId,
        textLength: replyText.length
      });

      // Find the business associated with this email by looking up the original email
      const { data: emailRecord, error: emailError } = await supabase
        .from('activities')
        .select('business_id, metadata')
        .eq('type', 'EMAIL_SENT')
        .ilike('metadata->>recipientEmail', replyEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (emailError || !emailRecord) {
        console.log('Could not find original email record:', emailError);
        
        // For testing - if this is axpg31@gmail.com, create a test scenario
        if (replyEmail === 'axpg31@gmail.com') {
          console.log('Test email detected - using test business scenario');
          
          // Find any recent business for testing
          const { data: recentBusiness, error: businessError } = await supabase
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
        
        // Try to find by business with this prospect email
        const { data: businessRecord, error: businessError } = await supabase
          .from('prospects')
          .select('business_id')
          .eq('email', replyEmail)
          .limit(1)
          .single();

        if (businessError || !businessRecord) {
          console.log('Could not find business for email:', replyEmail);
          return Response.json({ error: 'No business found for this email' }, { status: 404 });
        }

        const businessId = businessRecord.business_id;
        await handleEmailReply(businessId, replyEmail, replyText, subject, originalEmailId);
      } else {
        const businessId = emailRecord.business_id;
        await handleEmailReply(businessId, replyEmail, replyText, subject, originalEmailId);
      }

      return Response.json({ success: true, message: 'Email reply processed' });
    }

    // Handle other webhook events
    console.log('Unhandled webhook type:', body.type);
    return Response.json({ success: true, message: 'Webhook received but not processed' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 });
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
