// src/lib/sendgrid-integration.js
// SendGrid integration for sending emails with reply tracking

const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send email via SendGrid with reply tracking enabled
 * @param {Object} emailData - Email details
 * @returns {Promise} Send result
 */
export async function sendEmailViaSendGrid(emailData) {
  const { to, subject, html, text, from, businessId, tags } = emailData;

  const msg = {
    to: to,
    from: from || process.env.SENDGRID_FROM_EMAIL || 'hello@launchfly.ai',
    subject: subject,
    text: text || '',
    html: html || text,
    
    // Enable tracking
    trackingSettings: {
      clickTracking: {
        enable: true,
        enableText: true
      },
      openTracking: {
        enable: true,
        substitutionTag: '%open-track%'
      }
    },
    
    // Custom args for identifying the email in webhooks
    customArgs: {
      business_id: businessId || '',
      campaign_type: 'customer_acquisition',
      ...(tags || {})
    },
    
    // Reply-To header for tracking
    replyTo: from || process.env.SENDGRID_FROM_EMAIL || 'hello@launchfly.ai'
  };

  try {
    const [response] = await sgMail.send(msg);
    
    return {
      success: true,
      emailId: response.headers['x-message-id'] || `sg_${Date.now()}`,
      provider: 'sendgrid',
      messageId: response.headers['x-message-id']
    };
  } catch (error) {
    console.error('SendGrid send error:', error);
    
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    
    return {
      success: false,
      error: error.message,
      provider: 'sendgrid'
    };
  }
}

/**
 * Parse SendGrid inbound email webhook
 * @param {Object} payload - SendGrid inbound payload
 * @returns {Object} Parsed email data
 */
export function parseSendGridInbound(payload) {
  return {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    attachments: payload.attachments || [],
    headers: payload.headers,
    envelope: payload.envelope,
    charsets: payload.charsets,
    spam_score: payload.spam_score,
    spam_report: payload.spam_report
  };
}

/**
 * Parse SendGrid event webhook
 * @param {Array} events - SendGrid event array
 * @returns {Array} Parsed events
 */
export function parseSendGridEvents(events) {
  return events.map(event => ({
    email: event.email,
    timestamp: event.timestamp,
    event: event.event, // sent, delivered, open, click, bounce, etc.
    url: event.url, // for click events
    userAgent: event.useragent,
    ip: event.ip,
    businessId: event.business_id,
    customArgs: event
  }));
}



