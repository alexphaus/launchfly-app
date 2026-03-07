// src/lib/demo/flow.ts
// ═══════════════════════════════════════════════════════════════════════════
// Interactive WhatsApp Sales Demo — Flow Engine
// ═══════════════════════════════════════════════════════════════════════════
//
// Simulates the homeowner quote follow-up experience for contractors.
// Triggered after a Retell cold call. The contractor taps through
// an interactive WhatsApp conversation that demos the product.
//
// Flow:
//   STEP 1 → "Your demo is ready — tap below" (business-initiated template)
//   STEP 2 → Bot goes live as the "homeowner follow-up" simulation
//   STEP 3a → Price objection handling demo
//   STEP 3b → Fourth wall break (the reveal)
//   STEP 4 → Close with Stripe link
//   FALLBACK → 10-min no-reply nudge
//
// WhatsApp interactive buttons are sent via Twilio's `persistentAction`
// field for session messages, or Content Templates for business-initiated.

import twilio from 'twilio';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface DemoSession {
  id: string;
  phone: string;
  owner_name: string;
  business_name: string | null;
  business_id: string | null;
  step: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  outcome: string | null;
  stripe_session_id: string | null;
  fallback_sent: boolean;
}

export type DemoStep =
  | 'pending'          // Created, waiting to send Step 1
  | 'step1_sent'       // "Tap to start demo" sent
  | 'step2_sent'       // Homeowner simulation sent
  | 'step3a_sent'      // Price objection handling sent
  | 'step3b_sent'      // Fourth wall break sent
  | 'step4_sent'       // Final close sent
  | 'completed'        // They converted or we're done
  | 'timeout';         // No response after fallback

// ═══════════════════════════════════════════════════════════════════════════
// TWILIO CLIENT
// ═══════════════════════════════════════════════════════════════════════════

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  return twilio(sid, token);
}

function getWhatsAppFrom(): string {
  const from = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_WHATSAPP_NUMBER;
  if (!from) throw new Error('Missing TWILIO_WHATSAPP_FROM or TWILIO_WHATSAPP_NUMBER');
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
}

function toWhatsApp(phone: string): string {
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE SENDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send a plain WhatsApp text message.
 */
async function sendText(to: string, body: string): Promise<string> {
  const client = getTwilioClient();
  const msg = await client.messages.create({
    from: getWhatsAppFrom(),
    to: toWhatsApp(to),
    body,
  });
  return msg.sid;
}

/**
 * Send an interactive WhatsApp message using Twilio Content API.
 * The `contentSid` must be a pre-approved template with quick-reply buttons.
 *
 * For session messages (within 24h window), we use free-form with
 * `persistentAction` links that render as tappable buttons on WhatsApp.
 */
async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: string[],
): Promise<string> {
  // Use Twilio's native interactive message format for WhatsApp
  // This sends quick-reply style buttons within the session window
  const client = getTwilioClient();

  // Twilio WhatsApp supports interactive messages via the messaging API
  // We use persistentAction for URL buttons or body + quick replies
  const msg = await client.messages.create({
    from: getWhatsAppFrom(),
    to: toWhatsApp(to),
    body,
    // Quick-reply buttons via Twilio's WhatsApp interactive format
    // These are rendered as tappable button chips below the message
    persistentAction: buttons.map((btn) => `reply:${btn}`),
  });

  return msg.sid;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step 1 — Delivery (immediate after Retell webhook).
 * Business-initiated: "Your 30-sec demo is ready."
 */
export async function sendStep1(session: DemoSession): Promise<void> {
  const name = session.owner_name.split(' ')[0] || session.owner_name;

  await sendInteractiveButtons(
    session.phone,
    `Hey ${name} 👋 Sarah here. Your 30-sec demo is ready — ` +
    `tap below to see what your homeowners receive after a quote.`,
    ['▶ Start Demo'],
  );
}

/**
 * Step 2 — Bot goes live as homeowner follow-up simulation.
 * We pretend to be the follow-up bot texting the contractor's "homeowner."
 */
export async function sendStep2(session: DemoSession): Promise<void> {
  const name = session.owner_name.split(' ')[0] || session.owner_name;
  const biz = session.business_name || 'your company';

  // Small delay to feel real (1.5s simulated typing)
  await sleep(1500);

  await sendInteractiveButtons(
    session.phone,
    `💬 _Imagine this lands on your customer's phone:_\n\n` +
    `"Hi ${name}! This is Sarah following up on the estimate ` +
    `*${biz}* sent over on Tuesday. Did you get a chance to look it over? ` +
    `Happy to answer any questions on the pricing or get you on the schedule!"`,
    ['Looks good, let\'s book', 'Price is too high', 'Still thinking'],
  );
}

/**
 * Step 3a — Price objection handling demo.
 * Shows how the bot handles "price is too high."
 */
export async function sendStep3a(session: DemoSession): Promise<void> {
  await sleep(1200);

  await sendInteractiveButtons(
    session.phone,
    `"Totally get it — big investment! A lot of our clients use ` +
    `12-month financing that brings it down to about $250/mo.\n\n` +
    `Want me to send over the financing info, or would you prefer ` +
    `a quick call with the team to look at options?"`,
    ['Send financing info', 'Book a call'],
  );
}

/**
 * Step 3 — "Still thinking" response demo.
 */
export async function sendStillThinking(session: DemoSession): Promise<void> {
  await sleep(1200);

  await sendText(
    session.phone,
    `"No rush at all! I'll check back in a few days. ` +
    `In the meantime, just reply here anytime if a question pops up. 👍"`,
  );

  await sleep(2000);

  // Fourth wall break after showing the response
  await sendStep3b(session);
}

/**
 * Step 3b — Fourth Wall Break (the reveal).
 * "That just happened automatically."
 */
export async function sendStep3b(session: DemoSession): Promise<void> {
  const name = session.owner_name.split(' ')[0] || session.owner_name;

  await sleep(2000);

  await sendInteractiveButtons(
    session.phone,
    `👆 That just happened automatically.\n\n` +
    `While you were reading that, the bot handled a pricing objection ` +
    `and offered to book a call back to your calendar — all without you ` +
    `lifting a finger.\n\n` +
    `We're setting up contractors in your area this week, ${name}. ` +
    `Want your system live by tomorrow?`,
    ['Start today — $150/mo', 'How much is it?'],
  );
}

/**
 * Step 4a — "Start today" → Stripe link fires immediately.
 */
export async function sendStep4_StartToday(session: DemoSession): Promise<string> {
  const name = session.owner_name.split(' ')[0] || session.owner_name;
  const stripeLink = await getOrCreateStripeLink(session);

  await sendText(
    session.phone,
    `🎉 Let's do it, ${name}! Here's your setup link:\n\n` +
    `${stripeLink}\n\n` +
    `⚡ We'll have your system live within 24 hours of payment. ` +
    `You'll get a WhatsApp message from me with next steps as soon as it goes through.`,
  );

  return stripeLink;
}

/**
 * Step 4b — "How much is it?" → Price breakdown + Stripe link.
 */
export async function sendStep4_HowMuch(session: DemoSession): Promise<string> {
  const stripeLink = await getOrCreateStripeLink(session);

  await sendText(
    session.phone,
    `$150/mo, no contracts. Cancel anytime.\n\n` +
    `One recovered kitchen or bath job pays for it for the next 4 years.\n\n` +
    `Setup link: ${stripeLink}\n\n` +
    `⚡ Live within 24hrs of payment.`,
  );

  return stripeLink;
}

/**
 * Fallback — 10 min no reply after Step 1.
 */
export async function sendFallback(session: DemoSession): Promise<void> {
  const name = session.owner_name.split(' ')[0] || session.owner_name;

  await sendInteractiveButtons(
    session.phone,
    `Still there ${name}? Saved your demo — tap to pick up where you left off 👇`,
    ['Resume Demo'],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE LINK GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

async function getOrCreateStripeLink(session: DemoSession): Promise<string> {
  // Check if we already have a static env link (simpler setup)
  const staticLink = process.env.DEMO_STRIPE_PAYMENT_LINK;
  if (staticLink) return staticLink;

  // Otherwise, create a dynamic Stripe Checkout session
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          recurring: { interval: 'month' },
          unit_amount: 15000, // $150/mo
          product_data: {
            name: 'Quote Follow-Up System',
            description: `Automated quote follow-up for ${session.business_name || session.owner_name}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      demo_session_id: session.id,
      phone: session.phone,
      owner_name: session.owner_name,
      source: 'whatsapp_demo',
    },
    success_url: `${appUrl}/demo/success?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/demo/cancel`,
  });

  return checkoutSession.url ?? staticLink ?? appUrl;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER — Handle inbound button taps / text replies
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process an inbound message from the contractor during the demo.
 * Returns the new step name after processing.
 */
export async function handleDemoReply(
  session: DemoSession,
  message: string,
): Promise<string> {
  const lower = message.trim().toLowerCase();

  switch (session.step) {
    // ── Waiting for "Start Demo" tap ────────────────────────────────────
    case 'step1_sent': {
      if (lower.includes('start demo') || lower.includes('resume demo') || lower.includes('start') || lower.includes('resume') || lower.includes('demo')) {
        await sendStep2(session);
        return 'step2_sent';
      }
      // Unknown reply at step 1 — nudge them
      await sendText(session.phone, `Tap the "▶ Start Demo" button below to see it in action! 👇`);
      return 'step1_sent';
    }

    // ── Homeowner simulation — 3 button choices ─────────────────────────
    case 'step2_sent': {
      if (lower.includes('price') || lower.includes('too high') || lower.includes('expensive')) {
        await sendStep3a(session);
        return 'step3a_sent';
      }
      if (lower.includes('still thinking') || lower.includes('thinking') || lower.includes('not sure')) {
        await sendStillThinking(session);
        return 'step3b_sent';
      }
      if (lower.includes('book') || lower.includes('looks good') || lower.includes('let\'s book') || lower.includes('schedule')) {
        // Skip to fourth wall break
        await sendStep3b(session);
        return 'step3b_sent';
      }
      // Freeform reply — treat as engagement, show fourth wall break
      await sendStep3b(session);
      return 'step3b_sent';
    }

    // ── Price objection demo — financing or book a call ─────────────────
    case 'step3a_sent': {
      if (lower.includes('financing') || lower.includes('send') || lower.includes('info')) {
        // Show a fake financing link, then fourth wall break
        await sendText(session.phone,
          `"Here's the financing application — takes about 60 seconds, ` +
          `no hard credit pull:\n\nhttps://financing-demo.example.com\n\n` +
          `Let me know if you have any questions!"`,
        );
        await sendStep3b(session);
        return 'step3b_sent';
      }
      // "Book a call" or any other reply → fourth wall break
      await sendStep3b(session);
      return 'step3b_sent';
    }

    // ── Fourth wall break — start today or how much ─────────────────────
    case 'step3b_sent': {
      if (lower.includes('start today') || lower.includes('150') || lower.includes('let\'s do it') || lower.includes('sign up') || lower.includes('yes') || lower.includes('ready')) {
        await sendStep4_StartToday(session);
        return 'completed';
      }
      if (lower.includes('how much') || lower.includes('price') || lower.includes('cost') || lower.includes('pricing')) {
        await sendStep4_HowMuch(session);
        return 'step4_sent';
      }
      // Any other reply — treat as interest, send pricing
      await sendStep4_HowMuch(session);
      return 'step4_sent';
    }

    // ── Final close — they already saw price ────────────────────────────
    case 'step4_sent': {
      if (lower.includes('start') || lower.includes('sign') || lower.includes('yes') || lower.includes('let\'s') || lower.includes('do it') || lower.includes('ready')) {
        await sendStep4_StartToday(session);
        return 'completed';
      }
      // They're replying at the final step — engage naturally
      await sendText(session.phone,
        `Happy to answer any questions! The quick version: $150/mo, no contracts, ` +
        `and we have your system live within 24 hours. Just tap the link above when you're ready. 🚀`,
      );
      return 'step4_sent';
    }

    default:
      return session.step;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTIL
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
