// src/app/api/webhook/agent/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Generic Agent Webhook — Wake the agent from ANY external API
//
// Any service (Retell, Zapier, Stripe, CRM, custom) can POST here to
// trigger an agent task with the webhook payload as context.
//
// URL format:
//   POST https://app.launchfly.ai/api/webhook/agent?key=<webhook_secret>
//
// The agent receives the full payload and instructions from the
// `webhook_instructions` field in business_integrations, or a sensible
// default that tells it to analyze the event and act accordingly.
//
// Setup:
//   1. Insert a row in business_integrations:
//      service_name: "retell_webhook" (or any label)
//      config: { webhook_secret: "random-uuid", instructions: "When a call ends..." }
//   2. Give the external service this URL + ?key=<webhook_secret>
//   3. When the service fires, the agent wakes up with full context.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAgentTask } from '@/lib/agent/runner';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  try {
    const webhookKey = request.nextUrl.searchParams.get('key');

    if (!webhookKey || webhookKey.length < 10) {
      return NextResponse.json({ error: 'Missing or invalid webhook key' }, { status: 401 });
    }

    // Parse the incoming payload (JSON or form-data)
    let payload: Record<string, unknown>;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('form')) {
      const form = await request.formData();
      payload = Object.fromEntries(form.entries()) as Record<string, unknown>;
    } else {
      // Try JSON, fall back to raw text
      try {
        payload = await request.json();
      } catch {
        const text = await request.text();
        payload = { raw_body: text };
      }
    }

    const supabase = getSupabase();

    // ── Look up which business owns this webhook key ──
    // The webhook_secret is stored in config.webhook_secret
    const { data: integrations, error: lookupErr } = await supabase
      .from('business_integrations')
      .select('id, business_id, service_name, description, config, status')
      .eq('status', 'active');

    if (lookupErr) {
      console.error('[webhook/agent] DB lookup error:', lookupErr.message);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    // Find the integration whose config.webhook_secret matches the key
    // Use timing-safe comparison approach (constant-time for same length)
    const integration = integrations?.find(i => {
      const secret = (i.config as Record<string, unknown>)?.webhook_secret;
      return typeof secret === 'string' && secret.length === webhookKey.length && secret === webhookKey;
    });

    if (!integration) {
      return NextResponse.json({ error: 'Invalid webhook key' }, { status: 401 });
    }

    const businessId = integration.business_id;
    const serviceName = integration.service_name;
    const config = (integration.config || {}) as Record<string, unknown>;
    const instructions = (config.instructions as string) || '';

    console.log(`[webhook/agent] Received ${serviceName} event for business ${businessId}`);

    // ── Get owner phone for reports ──
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, whatsapp_notify_number, phone_number')
      .eq('id', businessId)
      .single();

    const ownerPhone = biz?.whatsapp_notify_number || biz?.phone_number || undefined;
    const bizName = biz?.name || 'the business';

    // ── Build the agent goal from instructions + payload ──
    // Truncate payload to prevent context overflow
    const payloadStr = JSON.stringify(payload, null, 2).substring(0, 4000);

    const goal = instructions
      ? `[WEBHOOK EVENT: ${serviceName}]\n\n## YOUR INSTRUCTIONS\n${instructions}\n\n## INCOMING EVENT DATA\n\`\`\`json\n${payloadStr}\n\`\`\``
      : `[WEBHOOK EVENT: ${serviceName}]\n\nAn external service "${serviceName}" just sent an event to ${bizName}. Analyze the data below, determine what happened, and take the most appropriate action. If you're unsure what to do, send a summary report to the owner.\n\n## EVENT DATA\n\`\`\`json\n${payloadStr}\n\`\`\``;

    const role = `You are the AI agent for ${bizName}. An external webhook event just arrived from "${serviceName}". Read the event data carefully, understand the context, and execute the instructions provided. If no specific instructions exist, analyze the event, determine the right action (update records, notify the owner, follow up with a customer, etc.), and report what you did.`;

    const { taskId, dispatched } = await createAgentTask({
      businessId,
      goal,
      role,
      ownerPhone,
    });

    console.log(`[webhook/agent] Dispatched task ${taskId} for ${serviceName} (business ${businessId})`);

    return NextResponse.json({
      ok: true,
      taskId,
      dispatched,
      service: serviceName,
    });
  } catch (err) {
    console.error('[webhook/agent] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
