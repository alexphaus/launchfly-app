// /api/webhook/missed-call/route.ts
// Missed Call → Instant WhatsApp Lead Capture
//
// Triggered by TWO sources:
//   1. Mobile automation (Tasker / n8n / Android Automate) — JSON POST
//   2. Twilio Voice StatusCallback (no-answer / busy / failed) — form-encoded POST
//
// Flow:
//   Missed call detected → look up business → save lead → WhatsApp in ~5 seconds

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || '+13203627874';
const MISSED_CALL_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_MISSEDCALL_FOLLOWUP || '';

// ─────────────────────────────────────────────
// Helper: resolve business from phone or id
// ─────────────────────────────────────────────
async function lookupBusiness(opts: {
    businessId?: string;
    ownerPhone?: string; // the "To" number — the tech's line that was called
}): Promise<{ id: string; name: string; niche: string | null } | null> {
    if (opts.businessId) {
        const { data, error } = await supabase
            .from('businesses')
            .select('id, name, business_data')
            .eq('id', opts.businessId)
            .single();
        if (error) {
            console.error('[missed-call] lookupBusiness by id error:', error.message);
            return null;
        }
        if (!data) return null;
        return { id: data.id, name: data.name, niche: (data as any).business_data?.niche ?? null };
    }

    if (opts.ownerPhone) {
        const clean = opts.ownerPhone.replace(/\D/g, '');
        const withPlus = `+${clean}`;
        const { data, error } = await supabase
            .from('businesses')
            .select('id, name, business_data')
            .or(
                `whatsapp_number.eq.${withPlus},whatsapp_number.eq.${clean},` +
                `phone_number.eq.${withPlus},phone_number.eq.${clean}`
            )
            .limit(1)
            .single();
        if (error) {
            console.error('[missed-call] lookupBusiness by phone error:', error.message);
            return null;
        }
        if (!data) return null;
        return { id: data.id, name: data.name, niche: (data as any).business_data?.niche ?? null };
    }

    return null;
}

// ─────────────────────────────────────────────
// Helper: normalise a phone number to E.164
// ─────────────────────────────────────────────
function normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    return digits.startsWith('+') ? raw : `+${digits}`;
}

// ─────────────────────────────────────────────
// Helper: build the WhatsApp message text
// ─────────────────────────────────────────────
function buildMessage(businessName: string, niche: string | null): string {
    const service = niche?.toLowerCase() || 'service';
    return (
        `Hey! Sorry I missed your call — I'm on a job right now 🔧\n\n` +
        `I'm ${businessName}. What do you need help with, and what's your location? ` +
        `I'll get back to you shortly! 👍`
    );
}

// ─────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get('content-type') || '';

        let fromPhone = '';
        let ownerPhone = '';
        let businessId = '';
        let callStatus = '';

        // ── Parse body (JSON or Twilio form-encoded) ──
        if (contentType.includes('application/json')) {
            // Supports: MacroDroid, n8n, Retell AI (wraps in `args`), or flat JSON
            const body = await req.json();
            // Retell AI sends { args: { businessId, fromPhone }, call_id, ... }
            const args = body.args || body;
            fromPhone   = args.fromPhone   || args.from_phone   || args.caller      || args.user_number || '';
            ownerPhone  = args.ownerPhone  || args.to_phone     || args.businessPhone || '';
            businessId  = args.businessId  || args.business_id  || '';
            callStatus  = 'no-answer'; // automation / Retell only fires on intent
            console.log('[missed-call] JSON payload:', JSON.stringify(body).substring(0, 500));
        } else {
            // Twilio Voice StatusCallback (application/x-www-form-urlencoded)
            const form  = await req.formData();
            fromPhone   = String(form.get('From')       || '');
            ownerPhone  = String(form.get('To')         || '');
            callStatus  = String(form.get('CallStatus') || '').toLowerCase();
        }

        // Only act on missed / unanswered calls
        const terminalMissed = ['no-answer', 'busy', 'failed', 'canceled', 'no_answer'];
        if (callStatus && !terminalMissed.includes(callStatus)) {
            return NextResponse.json({ skip: true, callStatus });
        }

        if (!fromPhone) {
            return NextResponse.json({ error: 'fromPhone is required' }, { status: 400 });
        }

        const callerPhone  = normalisePhone(fromPhone);
        const ownerPhoneN  = ownerPhone ? normalisePhone(ownerPhone) : '';

        // ── Look up the business ──
        const business = await lookupBusiness({ businessId: businessId || undefined, ownerPhone: ownerPhoneN || undefined });

        if (!business) {
            console.warn('[missed-call] No business found for ownerPhone=%s businessId=%s', ownerPhoneN, businessId);
            // Still save the lead under a generic log — don't lose the caller
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // ── Upsert lead — avoid duplicate rows for same caller + business ──
        const { data: existing } = await supabase
            .from('customers')
            .select('id, name, status')
            .eq('business_id', business.id)
            .eq('phone', callerPhone)
            .maybeSingle();

        let leadId: string;

        if (existing) {
            leadId = existing.id;
            // Only update status back to 'lead' if they're not already further along
            if (!['booked', 'confirmed', 'completed'].includes(existing.status)) {
                await supabase
                    .from('customers')
                    .update({
                        status: 'lead',
                        notes: (existing as any).notes
                            ? `${(existing as any).notes}\n[MISSED CALL ${new Date().toISOString()}]`
                            : `[MISSED CALL ${new Date().toISOString()}]`,
                        source: 'missed_call',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', leadId);
            }
        } else {
            const { data: newLead, error: insertErr } = await supabase
                .from('customers')
                .insert({
                    business_id: business.id,
                    phone: callerPhone,
                    email: `missed-call-${Date.now()}@placeholder.local`, // customers.email is NOT NULL
                    name: 'Missed Call',
                    status: 'lead',
                    source: 'missed_call',
                    notes: `[MISSED CALL ${new Date().toISOString()}]`,
                })
                .select('id')
                .single();

            if (insertErr) {
                console.error('[missed-call] Insert error:', insertErr);
                return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
            }
            leadId = newLead!.id;
        }

        // ── Send WhatsApp instantly (using approved template to bypass 24h window) ──
        const toWhatsApp   = `whatsapp:${callerPhone}`;
        const fromWhatsApp = `whatsapp:${FROM_NUMBER}`;

        try {
            if (MISSED_CALL_TEMPLATE_SID) {
                // Use Twilio Content Template — works outside 24h window
                // Template: "Hi! 👋 Sorry we missed your call — we're likely on a job right now.
                //  This is {{1}} — how can we help you? ..."
                // Quick replies: Get a Quote | Book a Service | Just a Question
                await twilioClient.messages.create({
                    from: fromWhatsApp,
                    to:   toWhatsApp,
                    contentSid: MISSED_CALL_TEMPLATE_SID,
                    contentVariables: JSON.stringify({
                        '1': business.name,
                    }),
                });
                console.log('[missed-call] ✅ Template WhatsApp sent to %s (template: %s)', callerPhone, MISSED_CALL_TEMPLATE_SID);
            } else {
                // Fallback: freeform message (only works if customer messaged within 24h)
                const message = buildMessage(business.name, business.niche);
                await twilioClient.messages.create({
                    from: fromWhatsApp,
                    to:   toWhatsApp,
                    body: message,
                });
                console.log('[missed-call] ✅ Freeform WhatsApp sent to %s', callerPhone);
            }

            // Log activity for the dashboard
            await supabase.from('ai_activities').insert({
                business_id: business.id,
                type: 'missed_call_followup',
                icon: '📞',
                message: `Auto-replied to missed call from ${callerPhone}`,
                details: `Lead saved & WhatsApp sent in <5s`,
                metadata: { leadId, callerPhone },
            });

            console.log('[missed-call] ✅ WhatsApp sent to %s for business %s', callerPhone, business.id);
        } catch (waErr: any) {
            // WhatsApp send failed (e.g. caller has no WA) — lead is still saved
            console.error('[missed-call] WhatsApp send failed:', waErr?.message);
            return NextResponse.json({
                success: false,
                leadSaved: true,
                leadId,
                error: 'WhatsApp delivery failed — lead still saved',
            });
        }

        return NextResponse.json({ success: true, leadId, callerPhone, businessId: business.id });

    } catch (err: any) {
        console.error('[missed-call] Unhandled error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

// Twilio sometimes sends GET to verify the endpoint — return 200
export async function GET() {
    return NextResponse.json({ ok: true, endpoint: 'missed-call webhook' });
}
