// E-commerce Abandoned Cart Recovery System
// Expected Revenue Impact: +15-25% immediate boost

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Track cart abandonment - call this when cart sits idle for 30 minutes
 */
export async function trackCartAbandonment(cartSessionId) {
  try {
    // Mark cart as abandoned
    const { data: cartSession, error } = await supabase
      .from('cart_sessions')
      .update({
        abandoned_at: new Date().toISOString(),
      })
      .eq('session_token', cartSessionId)
      .select('*')
      .single();

    if (error) throw error;

    // Schedule abandoned cart recovery email
    if (cartSession.customer_email && cartSession.items.length > 0) {
      await scheduleAbandonedCartEmail(cartSession);
    }

    return { success: true };
  } catch (error) {
    console.error('Error tracking cart abandonment:', error);
    return { success: false, error };
  }
}

/**
 * Send abandoned cart recovery email
 */
async function scheduleAbandonedCartEmail(cartSession) {
  try {
    // Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', cartSession.business_id)
      .single();

    if (!business) return;

    const cartTotal = cartSession.total_amount;
    const itemCount = cartSession.items.length;
    const firstItem = cartSession.items[0];

    // Create recovery discount (10% off if over $50)
    const discountCode = `SAVE10-${Date.now()}`;
    const discountValue = cartTotal >= 50 ? 10 : 0;

    if (discountValue > 0) {
      await supabase.from('discount_codes').insert({
        business_id: cartSession.business_id,
        code: discountCode,
        type: 'percentage',
        value: discountValue,
        usage_limit: 1,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
      });
    }

    // Send recovery email
    const emailSubject = `${cartSession.customer_name || 'Hi there'}, you left something behind! 🛒`;
    const emailContent = generateAbandonedCartEmail({
      customerName: cartSession.customer_name,
      businessName: business.name,
      items: cartSession.items,
      total: cartTotal,
      discountCode: discountValue > 0 ? discountCode : null,
      discountValue,
      recoveryUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/sites/${business.subdomain}/checkout?recover=${cartSession.session_token}`,
    });

    await resend.emails.send({
      from: `${business.name} <noreply@launchfly.ai>`,
      to: cartSession.customer_email,
      subject: emailSubject,
      html: emailContent,
    });

    // Update cart session
    await supabase
      .from('cart_sessions')
      .update({
        recovery_emails_sent: (cartSession.recovery_emails_sent || 0) + 1,
      })
      .eq('id', cartSession.id);

    console.log(`Abandoned cart recovery email sent to ${cartSession.customer_email}`);
  } catch (error) {
    console.error('Error sending abandoned cart email:', error);
  }
}

/**
 * Generate abandoned cart recovery email HTML
 */
function generateAbandonedCartEmail({
  customerName,
  businessName,
  items,
  total,
  discountCode,
  discountValue,
  recoveryUrl,
}) {
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #eee;">
        <div style="display: flex; align-items: center;">
          <div style="font-size: 24px; margin-right: 15px;">${item.image || '📦'}</div>
          <div>
            <h4 style="margin: 0; color: #333;">${item.name}</h4>
            <p style="margin: 5px 0; color: #666;">Quantity: ${item.quantity}</p>
            <p style="margin: 0; font-weight: bold; color: #2563eb;">$${item.price}</p>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  const discountSection = discountCode ? `
    <div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0;">🎉 Special Offer Just For You!</h3>
      <p style="margin: 0; font-size: 18px;">Use code <strong>${discountCode}</strong> for ${discountValue}% off your order!</p>
      <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Valid for 48 hours only</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your cart is waiting!</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">${businessName}</h1>
      </div>

      <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
        <h2 style="color: #1e40af; margin: 0 0 15px 0;">
          ${customerName ? `Hi ${customerName}` : 'Hi there'}, you left something behind! 🛒
        </h2>
        <p style="margin: 0; color: #4b5563;">
          We noticed you were interested in these items. Don't let them slip away!
        </p>
      </div>

      ${discountSection}

      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 30px;">
        <div style="background: #f3f4f6; padding: 15px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; color: #374151;">Your Cart Items</h3>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
          <tr>
            <td style="padding: 20px; text-align: right; background: #f9fafb; font-weight: bold; font-size: 18px; color: #1e40af;">
              Total: $${total}
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${recoveryUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          Complete Your Purchase
        </a>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        <p>Questions? Reply to this email and we'll help you out!</p>
        <p>🔒 Secure checkout • 💳 All payment methods accepted • 🚚 Fast delivery</p>
      </div>

    </body>
    </html>
  `;
}

/**
 * Cart Recovery Automation - Run every 30 minutes
 */
export async function processAbandonedCarts() {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Find carts that have been idle for 30+ minutes and not yet marked as abandoned
    const { data: abandonedCarts, error } = await supabase
      .from('cart_sessions')
      .select('*')
      .lt('last_activity_at', thirtyMinutesAgo.toISOString())
      .is('abandoned_at', null)
      .not('customer_email', 'is', null)
      .gt('total_amount', 0);

    if (error) throw error;

    console.log(`Found ${abandonedCarts.length} abandoned carts to process`);

    for (const cart of abandonedCarts) {
      await trackCartAbandonment(cart.session_token);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { success: true, processed: abandonedCarts.length };
  } catch (error) {
    console.error('Error processing abandoned carts:', error);
    return { success: false, error };
  }
}

/**
 * Handle cart recovery when customer returns via email link
 */
export async function handleCartRecovery(cartToken, discountCode = null) {
  try {
    // Mark cart as recovered
    const { data: cartSession, error } = await supabase
      .from('cart_sessions')
      .update({
        recovered: true,
        recovered_at: new Date().toISOString(),
      })
      .eq('session_token', cartToken)
      .select('*')
      .single();

    if (error) throw error;

    // Apply discount if provided
    let discount = null;
    if (discountCode) {
      const { data: discountData } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('business_id', cartSession.business_id)
        .eq('code', discountCode)
        .eq('active', true)
        .single();

      if (discountData && (!discountData.expires_at || new Date(discountData.expires_at) > new Date())) {
        discount = discountData;
      }
    }

    return {
      success: true,
      cartSession,
      discount,
    };
  } catch (error) {
    console.error('Error handling cart recovery:', error);
    return { success: false, error };
  }
}
