// src/app/api/guarantee/check/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function runGuaranteeChecks(businessId) {
  const now = new Date();

  // Fetch candidate businesses
  const query = supabase
    .from('businesses')
    .select('id, user_id, name, subdomain, form_data, guarantee_start_at, first_payment_at, guarantee_48h_status, guarantee_60d_status, total_revenue, stripe_connect_account_id, plan_tier, rev_share_percent, session_id')
    .neq('guarantee_48h_status', 'paid');

  const { data: businesses, error } = businessId ? await query.eq('id', businessId) : await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = [];

  for (const b of businesses || []) {
    const updates = {};

    // Establish T0 if missing and we have a created_at timestamp
    if (!b.guarantee_start_at) {
      updates.guarantee_start_at = now.toISOString();
    }

    // 48h guarantee
    if (b.guarantee_start_at && b.guarantee_48h_status === 'pending') {
      const deadline48 = new Date(new Date(b.guarantee_start_at).getTime() + 48 * 60 * 60 * 1000);

      // Find first payment
      const { data: firstSale } = await supabase
        .from('sales')
        .select('created_at')
        .eq('business_id', b.id)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (firstSale) updates.first_payment_at = firstSale.created_at;

      if (firstSale && new Date(firstSale.created_at) <= deadline48) {
        updates.guarantee_48h_status = 'met';
      } else if (now > deadline48 && !firstSale) {
        // Missed. Attempt payout if Connect is configured; otherwise mark missed.
        try {
          if (stripe && b.stripe_connect_account_id) {
            // Transfer $100 to connected account (platform covers it)
            const transfer = await stripe.transfers.create({
              amount: 10000, // cents
              currency: 'usd',
              destination: b.stripe_connect_account_id,
              description: `Launchfly 48h guarantee payout for ${b.name}`,
            });
            updates.guarantee_48h_status = 'paid';
            updates.guarantee_48h_payout_id = transfer.id;
          } else {
            updates.guarantee_48h_status = 'missed';
          }

          // Notify user
          if (resend && b.form_data?.email) {
            await resend.emails.send({
              from: 'Launchfly <hello@launchfly.ai>',
              to: b.form_data.email,
              subject: 'Our 48-hour guarantee for your first customer',
              html: `
                <p>We promised a first customer within 48 hours of your intake. We didn't get there in time, and we're making it right.</p>
                <p>${b.stripe_connect_account_id ? 'A $100 payout has been sent to your connected Stripe account.' : 'We owe you $100; we will reach out to arrange the payout.'}</p>
                <p>We will keep working to hit $1,000 in 60 days. Your dashboard: ${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${b.session_id}</p>
              `
            });
          }
        } catch (payoutErr) {
          console.error('Payout error:', payoutErr);
          updates.guarantee_48h_status = 'missed';
        }
      }
    }

    // 60d guarantee
    if (b.guarantee_start_at && (b.guarantee_60d_status === 'pending' || b.guarantee_60d_status === 'extended')) {
      const deadline60 = new Date(new Date(b.guarantee_start_at).getTime() + 60 * 24 * 60 * 60 * 1000);

      // Sum sales since T0
      const { data: sumRows, error: sumErr } = await supabase
        .from('sales')
        .select('amount, created_at')
        .eq('business_id', b.id);
      if (!sumErr) {
        const totalSinceT0 = (sumRows || [])
          .filter(s => new Date(s.created_at) >= new Date(b.guarantee_start_at))
          .reduce((acc, s) => acc + Number(s.amount || 0), 0);
        if (totalSinceT0 >= 1000) {
          updates.guarantee_60d_status = 'met';
        } else if (now > deadline60) {
          updates.guarantee_60d_status = 'failed';
          updates.work_free_mode = true; // honor promise
        }
      }
    }

    if (Object.keys(updates).length) {
      updates.guarantee_last_checked_at = now.toISOString();
      await supabase.from('businesses').update(updates).eq('id', b.id);
    }

    results.push({ businessId: b.id, updates });
  }

  return { success: true, checked: results.length, results };
}

export async function POST(request) {
  // Optional payload: { businessId?: string }
  const { businessId } = await request.json().catch(() => ({}));
  const result = await runGuaranteeChecks(businessId);
  return Response.json(result);
}

export async function GET(request) {
  // Allow GET so it can be triggered by Vercel Cron. Support businessId via query param.
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId') || undefined;
  const result = await runGuaranteeChecks(businessId);
  return Response.json(result);
}
