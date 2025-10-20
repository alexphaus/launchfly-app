// src/app/api/webhook/sendgrid-inbound/route.js
// SendGrid Inbound Parse webhook - handles email replies

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logEmailReply } from '@/lib/activity-logger';
import { inngest } from '@/lib/inngest/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'SendGrid Inbound webhook active',
    timestamp: new Date().toISOString()
  });
}

// Handle SendGrid inbound emails (replies)
export async function POST(request) {
  console.log('=== SENDGRID INBOUND EMAIL RECEIVED ===');
  
  try {
    // SendGrid sends inbound emails as multipart/form-data
    const formData = await request.formData();
    
    const from = formData.get('from');
    const to = formData.get('to');
    const subject = formData.get('subject');
    const text = formData.get('text');
    const html = formData.get('html');
    const envelope = formData.get('envelope');
    
    console.log('Inbound email from:', from);
    console.log('Subject:', subject);
    
    // Extract email address from "Name <email@domain.com>" format
    const emailMatch = from?.match(/<(.+?)>/) || from?.match(/([^\s]+@[^\s]+)/);
    const replyEmail = emailMatch ? emailMatch[1] : from;
    
    if (!replyEmail) {
      console.log('Could not extract email address from:', from);
      return NextResponse.json({ error: 'Invalid from address' }, { status: 400 });
    }
    
    console.log('Extracted reply email:', replyEmail);

    // Find the business this email belongs to
    const businessInfo = await findBusinessByEmail(replyEmail);

    if (!businessInfo) {
      console.log('Could not find business for email:', replyEmail);
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const businessId = businessInfo.businessId;
    const replyText = text || html || '';

    // Analyze sentiment
    const sentiment = analyzeSentiment(replyText);

    // Create preview
    const previewText = replyText.substring(0, 100) + (replyText.length > 100 ? '...' : '');

    // Log the reply
    await logEmailReply(businessId, {
      recipientEmail: replyEmail,
      originalEmailId: null,
      replyText: replyText,
      subject: subject,
      sentiment: sentiment.type,
      isPositive: sentiment.isPositive,
      previewText: previewText
    });

    // Update prospect status to engaged
    await supabase
      .from('prospects')
      .update({ 
        status: 'engaged',
        updated_at: new Date().toISOString()
      })
      .eq('business_id', businessId)
      .ilike('email', replyEmail);

    // Trigger Inngest event for AI response
    if (process.env.INNGEST_EVENT_KEY) {
      await inngest.send({
        name: 'customer/email.response',
        data: {
          businessId: businessId,
          emailData: {
            emailId: null
          },
          responseData: {
            fromEmail: replyEmail,
            text: replyText,
            subject: subject,
            sentiment: sentiment.type,
            isPositive: sentiment.isPositive
          }
        }
      });
    }

    console.log('✅ Inbound email processed successfully');
    return NextResponse.json({ success: true, message: 'Reply tracked' });
    
  } catch (error) {
    console.error('SendGrid inbound error:', error);
    return NextResponse.json({ 
      error: 'Processing failed',
      details: error.message 
    }, { status: 500 });
  }
}

async function findBusinessByEmail(email) {
  // Try activities first
  const { data: emailRecord } = await supabase
    .from('ai_activities')
    .select('business_id, metadata')
    .eq('type', 'email_sent')
    .ilike('metadata->>recipientEmail', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (emailRecord) {
    return { businessId: emailRecord.business_id };
  }

  // Try prospects
  const { data: prospect } = await supabase
    .from('prospects')
    .select('business_id')
    .ilike('email', email)
    .single();

  if (prospect) {
    return { businessId: prospect.business_id };
  }

  return null;
}

function analyzeSentiment(text) {
  const lowerText = text.toLowerCase();
  
  const positiveKeywords = [
    'yes', 'interested', 'tell me more', 'sounds good', 'great',
    'lets talk', 'schedule', 'meeting', 'call', 'demo',
    'love', 'perfect', 'exactly', 'looking for'
  ];
  
  const negativeKeywords = [
    'no', 'not interested', 'remove', 'unsubscribe', 'stop',
    'dont contact', 'not right now', 'not a fit', 'no thanks'
  ];
  
  const positiveCount = positiveKeywords.filter(kw => lowerText.includes(kw)).length;
  const negativeCount = negativeKeywords.filter(kw => lowerText.includes(kw)).length;
  
  if (positiveCount > negativeCount) {
    return { type: 'positive', isPositive: true };
  } else if (negativeCount > positiveCount) {
    return { type: 'negative', isPositive: false };
  } else {
    return { type: 'neutral', isPositive: false };
  }
}



