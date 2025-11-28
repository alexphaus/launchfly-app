import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Unsubscribe Endpoint
 * 
 * Handles email opt-outs for CAN-SPAM compliance.
 * Updates the customer's accepts_marketing field to false.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const businessId = searchParams.get('businessId');

    if (!email) {
      return new Response(unsubscribePageHtml('error', 'Missing email parameter'), {
        headers: { 'Content-Type': 'text/html' },
        status: 400
      });
    }

    // Update customer record
    const query = supabase
      .from('customers')
      .update({ 
        accepts_marketing: false,
        email_sequence_completed_at: new Date().toISOString()
      })
      .eq('email', email);

    // If businessId provided, scope to that business
    if (businessId) {
      query.eq('business_id', businessId);
    }

    const { error } = await query;

    if (error) {
      console.error('Unsubscribe error:', error);
      return new Response(unsubscribePageHtml('error', 'Something went wrong. Please try again.'), {
        headers: { 'Content-Type': 'text/html' },
        status: 500
      });
    }

    // Log the unsubscribe event
    if (businessId) {
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'unsubscribe',
          icon: 'U',
          message: 'Lead unsubscribed',
          details: `${email} unsubscribed from email sequence`,
          metadata: { email }
        });
    }

    return new Response(unsubscribePageHtml('success'), {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response(unsubscribePageHtml('error', error.message), {
      headers: { 'Content-Type': 'text/html' },
      status: 500
    });
  }
}

/**
 * Generate a simple HTML page for the unsubscribe confirmation
 */
function unsubscribePageHtml(status, errorMessage = '') {
  const isSuccess = status === 'success';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${isSuccess ? 'Unsubscribed' : 'Error'}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          text-align: center;
        }
        .icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 28px;
        }
        .icon.success {
          background: #dcfce7;
          color: #16a34a;
        }
        .icon.error {
          background: #fee2e2;
          color: #dc2626;
        }
        h1 {
          color: #0f172a;
          font-size: 24px;
          margin-bottom: 12px;
        }
        p {
          color: #64748b;
          line-height: 1.6;
        }
        .error-detail {
          margin-top: 10px;
          padding: 10px;
          background: #fef2f2;
          border-radius: 8px;
          color: #b91c1c;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        ${isSuccess ? `
          <div class="icon success">✓</div>
          <h1>You've Been Unsubscribed</h1>
          <p>You will no longer receive emails from this business. We're sorry to see you go!</p>
        ` : `
          <div class="icon error">!</div>
          <h1>Oops, Something Went Wrong</h1>
          <p>We couldn't process your unsubscribe request.</p>
          ${errorMessage ? `<div class="error-detail">${errorMessage}</div>` : ''}
        `}
      </div>
    </body>
    </html>
  `;
}
