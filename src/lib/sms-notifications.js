// src/lib/sms-notifications.js
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Check if SMS notifications are properly configured
 */
export function isSmsConfigured() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  
  return Boolean(
    accountSid && 
    authToken && 
    fromNumber && 
    accountSid.startsWith('AC')
  );
}

/**
 * Get Twilio client instance
 */
function getTwilioClient() {
  if (!isSmsConfigured()) {
    throw new Error('Twilio is not properly configured');
  }
  
  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

/**
 * Get user's phone number and SMS preferences
 * @param {string} userId - User ID
 * @returns {Promise<{phoneNumber: string|null, smsEnabled: boolean}>}
 */
async function getUserSmsSettings(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('phone_number, sms_notifications_enabled')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user SMS settings:', error);
      return { phoneNumber: null, smsEnabled: false };
    }
    
    // Default to enabled if not explicitly set
    const smsEnabled = profile?.sms_notifications_enabled !== false;
    
    return {
      phoneNumber: profile?.phone_number || null,
      smsEnabled
    };
  } catch (error) {
    console.error('Error in getUserSmsSettings:', error);
    return { phoneNumber: null, smsEnabled: false };
  }
}

/**
 * Send SMS notification
 * @param {Object} params
 * @param {string} params.to - Phone number to send to
 * @param {string} params.message - Message content
 * @param {string} params.type - Notification type (for logging)
 * @param {string} params.businessId - Business ID (for logging)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendSms({ to, message, type, businessId }) {
  if (!isSmsConfigured()) {
    console.log('SMS not configured - skipping notification');
    return { success: false, error: 'SMS not configured' };
  }
  
  try {
    const client = getTwilioClient();
    
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    
    console.log(`✅ SMS sent successfully: ${type} to ${to} (${result.sid})`);
    
    // Log SMS notification to database
    try {
      await supabase.from('sms_notifications').insert({
        business_id: businessId,
        phone_number: to,
        message_type: type,
        message_content: message,
        twilio_message_id: result.sid,
        status: 'sent',
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error logging SMS notification:', logError);
      // Don't fail the SMS send if logging fails
    }
    
    return {
      success: true,
      messageId: result.sid
    };
  } catch (error) {
    console.error(`Error sending SMS (${type}):`, error);
    
    // Log failed SMS attempt
    try {
      await supabase.from('sms_notifications').insert({
        business_id: businessId,
        phone_number: to,
        message_type: type,
        message_content: message,
        status: 'failed',
        error_message: error.message,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error logging failed SMS:', logError);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send sale notification SMS
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.businessId - Business ID
 * @param {string} params.businessName - Business name
 * @param {number} params.amount - Sale amount
 * @param {string} params.customerName - Customer name
 * @param {boolean} params.isFirstSale - Whether this is the first sale
 * @param {number} params.totalRevenue - Total revenue after this sale
 */
export async function sendSaleSms({
  userId,
  businessId,
  businessName,
  amount,
  customerName,
  isFirstSale,
  totalRevenue
}) {
  try {
    const { phoneNumber, smsEnabled } = await getUserSmsSettings(userId);
    
    if (!phoneNumber || !smsEnabled) {
      console.log('SMS notifications not enabled or no phone number for user:', userId);
      return { success: false, reason: 'not_enabled' };
    }
    
    let message;
    if (isFirstSale) {
      message = `🎉 Your first sale! ${customerName} just purchased from ${businessName} for $${amount.toFixed(2)}. You're officially in business! 🚀`;
    } else {
      message = `💰 New sale! ${customerName} purchased $${amount.toFixed(2)} from ${businessName}. Total revenue: $${totalRevenue.toFixed(2)}`;
    }
    
    return await sendSms({
      to: phoneNumber,
      message,
      type: isFirstSale ? 'first_sale' : 'sale',
      businessId
    });
  } catch (error) {
    console.error('Error sending sale SMS:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send payout notification SMS
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.businessId - Business ID
 * @param {string} params.businessName - Business name
 * @param {number} params.amount - Payout amount
 * @param {string} params.speed - Payout speed ('instant' or 'standard')
 * @param {string} params.status - Payout status ('success', 'processing', 'failed')
 */
export async function sendPayoutSms({
  userId,
  businessId,
  businessName,
  amount,
  speed,
  status
}) {
  try {
    const { phoneNumber, smsEnabled } = await getUserSmsSettings(userId);
    
    if (!phoneNumber || !smsEnabled) {
      console.log('SMS notifications not enabled or no phone number for user:', userId);
      return { success: false, reason: 'not_enabled' };
    }
    
    let message;
    if (status === 'success' || status === 'processing') {
      const timeframe = speed === 'instant' ? 'instantly' : 'within 1-2 business days';
      message = `💸 Payout ${status === 'success' ? 'complete' : 'processing'}! $${amount.toFixed(2)} from ${businessName} is on its way ${timeframe}. 🎊`;
    } else {
      message = `⚠️ Payout issue: $${amount.toFixed(2)} payout from ${businessName} needs attention. Check your dashboard for details.`;
    }
    
    return await sendSms({
      to: phoneNumber,
      message,
      type: 'payout',
      businessId
    });
  } catch (error) {
    console.error('Error sending payout SMS:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send milestone notification SMS
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.businessId - Business ID
 * @param {string} params.businessName - Business name
 * @param {string} params.milestone - Milestone type (e.g., '1k_revenue', '10k_revenue')
 * @param {number} params.amount - Milestone amount
 */
export async function sendMilestoneSms({
  userId,
  businessId,
  businessName,
  milestone,
  amount
}) {
  try {
    const { phoneNumber, smsEnabled } = await getUserSmsSettings(userId);
    
    if (!phoneNumber || !smsEnabled) {
      console.log('SMS notifications not enabled or no phone number for user:', userId);
      return { success: false, reason: 'not_enabled' };
    }
    
    const milestoneMessages = {
      '1k_revenue': `🎯 Milestone reached! ${businessName} just hit $1,000 in revenue! Keep up the momentum! 🚀`,
      '5k_revenue': `🌟 Amazing! ${businessName} reached $5,000 in revenue! You're scaling! 📈`,
      '10k_revenue': `🏆 Incredible! ${businessName} hit $10,000 in revenue! That's major growth! 💪`,
      '50k_revenue': `🎊 Phenomenal! ${businessName} crossed $50,000 in revenue! You're crushing it! 🔥`,
      '100k_revenue': `💎 Legendary! ${businessName} reached $100,000 in revenue! Welcome to the 6-figure club! 👑`
    };
    
    const message = milestoneMessages[milestone] || 
      `🎉 ${businessName} reached $${amount.toFixed(0)} in revenue! Congratulations! 🎊`;
    
    return await sendSms({
      to: phoneNumber,
      message,
      type: 'milestone',
      businessId
    });
  } catch (error) {
    console.error('Error sending milestone SMS:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send test SMS to verify configuration
 * @param {string} phoneNumber - Phone number to send test to
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendTestSms(phoneNumber) {
  return await sendSms({
    to: phoneNumber,
    message: '🚀 Launchfly SMS notifications are working! You\'ll now receive instant alerts for sales and payouts.',
    type: 'test',
    businessId: 'test'
  });
}

