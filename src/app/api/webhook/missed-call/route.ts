// /api/webhook/missed-call/route.ts
// Missed Call → Lead Capture → Automation Engine
//
// Triggered by TWO sources:
//   1. Mobile automation (Tasker / n8n / Android Automate) — JSON POST
//   2. Twilio Voice StatusCallback (no-answer / busy / failed) — form-encoded POST
//
// Flow:
//   Missed call detected → look up business → save lead → fire automation rules

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

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
            // Mobile automation (Tasker, MacroDroid) or Retell AI Tool Webhook
            const body = await req.json();
            
            // Retell sends 3 possible shapes:
            //   1. Real call:  { args: { businessId, fromPhone } }
            //   2. Test panel: { type:"object", properties: { businessId: {const:"..."}, fromPhone: {const:"..."} } }
            //   3. Flat JSON:  { businessId, fromPhone }
            let payload: any;
            if (body.args) {
                // Retell real call — args wrapper
                payload = body.args;
            } else if (body.properties && body.type === 'object') {
                // Retell test panel sends the raw schema — extract const values
                payload = Object.fromEntries(
                    Object.entries(body.properties as Record<string, any>).map(
                        ([key, val]: [string, any]) => [key, val?.const ?? val?.default ?? '']
                    )
                );
            } else {
                // Flat JSON (MacroDroid / n8n / curl)
                payload = body;
            }

            fromPhone   = payload.fromPhone   || payload.from_phone   || payload.caller      || '';
            ownerPhone  = payload.ownerPhone  || payload.to_phone     || payload.businessPhone || '';
            businessId  = payload.businessId  || payload.business_id  || '';
            callStatus  = 'no-answer';
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

        if (!fromPhone || fromPhone.includes('{{')) {
            return NextResponse.json({ error: 'fromPhone is required (use Retell dynamic variables or provide a real phone number)' }, { status: 400 });
        }

        // Strip unresolved template markers from businessId too
        if (businessId.includes('{{')) businessId = '';

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

        // ── Fire automation rules (handles WhatsApp, templates, owner alerts, etc.) ──
        await supabase.from('ai_activities').insert({
            business_id: business.id,
            type: 'missed_call_followup',
            icon: '📞',
            message: `Missed call from ${callerPhone} — automation triggered`,
            details: `Lead saved, automation rules fired`,
            metadata: { leadId, callerPhone },
        });

        const { fireEvent } = await import('@/lib/automations/executor');
        const automationResult = await fireEvent({
            businessId: business.id,
            event: 'missed_call',
            phone: callerPhone,
            customerName: existing?.name || 'Missed Call',
            metadata: { leadId, source: 'missed_call_webhook', businessName: business.name },
        });

        console.log('[missed-call] ✅ Lead %s saved, %d automation rules fired for %s', leadId, automationResult.fired, callerPhone);

        return NextResponse.json({
            success: true,
            leadId,
            callerPhone,
            businessId: business.id,
            automations: { fired: automationResult.fired, results: automationResult.results },
        });

    } catch (err: any) {
        console.error('[missed-call] Unhandled error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

// Twilio sometimes sends GET to verify the endpoint — return 200
export async function GET() {
    return NextResponse.json({ ok: true, endpoint: 'missed-call webhook' });
}
