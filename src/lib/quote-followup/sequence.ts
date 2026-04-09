// src/lib/quote-followup/sequence.ts
// ═══════════════════════════════════════════════════════════════════════════
// 14-Day Revenue Recovery Sequence Engine
// ═══════════════════════════════════════════════════════════════════════════
//
// 7 touches in 14 days across 2 channels (WhatsApp + Retell AI Voice).
// Designed for high-ticket contractors (roofing, HVAC, remodeling).
//
// Step │ Day │ Time (local)   │ Channel        │ Purpose
// ─────┼─────┼────────────────┼────────────────┼───────────────────────────
//   0  │  0  │ +60s           │ WhatsApp       │ Receipt confirmation
//   1  │  2  │ 4:30 PM        │ WhatsApp       │ Value-add / credibility
//   2  │  4  │ 10:30 AM       │ Retell Voice   │ Human-sounding differentiator
//   3  │  7  │ 9:00 AM        │ WhatsApp       │ Scheduling constraint urgency
//   4  │ 10  │ 2:00 PM        │ WhatsApp       │ Financing / friction removal
//   5  │ 14  │ 3:00 PM        │ WhatsApp       │ Professional break-up
//
// Critical Rules:
// 1. Stop on Reply – sequence pauses instantly when prospect replies
// 2. Time-Zone Aware – only fires between 9 AM - 6 PM local time
// 3. Weekend Routing – delays to Monday 9 AM if lands on weekend
// 4. Handoff Protocol – high intent → alert contractor
// 5. Snooze Button – "not ready yet" → pause for N days
// 6. STOP at carrier level – Twilio handles opt-out, we just mark DB

import type { QuoteLead } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type SequenceChannel = 'whatsapp' | 'retell_voice';

export interface SequenceStep {
  step: number;
  dayOffset: number;          // Days after quote was created
  targetHour: number;         // Hour in local time (24h format)
  targetMinute: number;       // Minute in local time
  channel: SequenceChannel;
  purpose: string;
  /** Build the message text. For voice calls, this is the post-call missed-call text. */
  buildMessage: (ctx: MessageContext) => string;
  /** For voice calls only: build the voicemail text */
  buildVoicemail?: (ctx: MessageContext) => string;
}

export interface MessageContext {
  customerName: string;
  firstName: string;          // First name only
  ownerName: string;
  businessName: string;
  jobType: string;
  quoteAmount: string;        // Formatted with currency symbol
  currencySymbol: string;
  niche: string;
}

/**
 * Fill a message template string with context values.
 * Supports: {customerName}, {firstName}, {ownerName}, {businessName},
 *           {jobType}, {quoteAmount}, {currencySymbol}, {niche}
 */
function fillTemplate(template: string, ctx: MessageContext): string {
  return template
    .replace(/\{customerName\}/g, ctx.customerName)
    .replace(/\{firstName\}/g, ctx.firstName)
    .replace(/\{ownerName\}/g, ctx.ownerName)
    .replace(/\{businessName\}/g, ctx.businessName)
    .replace(/\{jobType\}/g, ctx.jobType)
    .replace(/\{quoteAmount\}/g, ctx.quoteAmount)
    .replace(/\{currencySymbol\}/g, ctx.currencySymbol)
    .replace(/\{niche\}/g, ctx.niche);
}

/** DB-stored step shape (from assistants.sequence_steps JSONB) */
interface DBSequenceStep {
  step: number;
  dayOffset: number;
  hour: number;
  minute: number;
  channel: string;
  message: string;
  voicemail?: string;
}

/** Convert DB-stored steps into runtime SequenceStep objects */
function dbStepsToSequenceSteps(dbSteps: DBSequenceStep[]): SequenceStep[] {
  return dbSteps.map((s, i) => ({
    step: i,
    dayOffset: s.dayOffset,
    targetHour: s.hour,
    targetMinute: s.minute,
    channel: (s.channel === 'retell_voice' ? 'retell_voice' : 'whatsapp') as SequenceChannel,
    purpose: `Step ${i} (custom)`,
    buildMessage: (ctx: MessageContext) => fillTemplate(s.message, ctx),
    buildVoicemail: s.voicemail ? (ctx: MessageContext) => fillTemplate(s.voicemail!, ctx) : undefined,
  }));
}

/**
 * Resolve the sequence steps for a lead: if the business has custom steps
 * configured in the assistants table, use those. Otherwise fall back to
 * the hardcoded SEQUENCE_STEPS.
 */
async function resolveSequenceSteps(businessId: string | null): Promise<SequenceStep[]> {
  if (!businessId) return SEQUENCE_STEPS;
  try {
    const supabase = getSupabase();
    const { data: assistant } = await supabase
      .from('assistants')
      .select('sequence_steps')
      .eq('business_id', businessId)
      .eq('active', true)
      .not('name', 'in', '("Purchasing OS","Chief of Staff","Marketing OS","Content & Growth OS")')
      .limit(1)
      .maybeSingle();

    const dbSteps = assistant?.sequence_steps as DBSequenceStep[] | null;
    if (dbSteps && Array.isArray(dbSteps) && dbSteps.length > 0) {
      console.log(`[sequence] Using ${dbSteps.length} custom steps from assistant config`);
      return dbStepsToSequenceSteps(dbSteps);
    }
  } catch (err) {
    console.error('[sequence] Error loading assistant sequence_steps, using defaults:', err);
  }
  return SEQUENCE_STEPS;
}

export function buildMessageContext(
  lead: QuoteLead,
  biz?: { name?: string; ownerName?: string; niche?: string },
): MessageContext {
  const sym = (lead.currency === 'RM' ? 'RM' : '$');
  return {
    customerName: lead.name,
    firstName: lead.name.split(' ')[0] || lead.name,
    ownerName: biz?.ownerName || 'the team',
    businessName: biz?.name || 'our team',
    jobType: lead.job_type,
    quoteAmount: `${sym}${lead.quote_amount.toLocaleString()}`,
    currencySymbol: sym,
    niche: biz?.niche || 'home service',
  };
}

/**
 * The 7-step, 14-day Revenue Recovery Sequence.
 * Each step's `buildMessage` produces the WhatsApp text.
 */
export const SEQUENCE_STEPS: SequenceStep[] = [
  // ─── Step 0: Day 0 — Immediate Confirmation (within 60s) ──────────────
  {
    step: 0,
    dayOffset: 0,
    targetHour: -1,            // -1 = fire immediately (no time targeting)
    targetMinute: 0,
    channel: 'whatsapp',
    purpose: 'Receipt confirmation + micro-commitment',
    buildMessage: (ctx) =>
      `Hi ${ctx.firstName}, it's the team at *${ctx.businessName}*. ` +
      `${ctx.ownerName} just sent over the estimate for your ${ctx.jobType} project. ` +
      `Just shooting you a quick text so you have a direct line to us if any questions pop up while you look it over. ` +
      `Did it come through? 📋`,
  },

  // ─── Step 1: Day 2 — Value-Add / Credibility (4:30 PM local) ──────────
  {
    step: 1,
    dayOffset: 2,
    targetHour: 16,
    targetMinute: 30,
    channel: 'whatsapp',
    purpose: 'Value-add credibility + soft objection probe',
    buildMessage: (ctx) =>
      `Hey ${ctx.firstName}, hope you're having a good week! ` +
      `While you're reviewing the estimate, I wanted to mention — ` +
      `${ctx.ownerName} offers a written workmanship guarantee on every ${ctx.jobType.toLowerCase()} project we do. ` +
      `Happy to share details if you're curious. ` +
      `Any questions so far? 🏠`,
  },

  // ─── Step 2: Day 4 — Retell AI Voice Call (10:30 AM local) ─────────────
  {
    step: 2,
    dayOffset: 4,
    targetHour: 10,
    targetMinute: 30,
    channel: 'retell_voice',
    purpose: 'Human-sounding differentiator call',
    // This message is sent as a text 2 min AFTER a missed/voicemail call
    buildMessage: (ctx) =>
      `Hey ${ctx.firstName}, just tried giving you a quick ring about the estimate but missed you. ` +
      `No rush to call back — just let me know here via text when you've had a chance to review it either way! 📞`,
    // Voicemail script (used as Retell dynamic variable)
    buildVoicemail: (ctx) =>
      `Hey ${ctx.firstName}, this is a follow-up from ${ctx.ownerName} at ${ctx.businessName}. ` +
      `I know you're super busy, but I wanted to give you a quick ring to see if you had a chance to go over the quote. ` +
      `We're locking in our crew's schedule for the next couple of weeks, and I wanted to see where you were at. ` +
      `Feel free to text us back at this number — it's the fastest way to reach us. Talk soon!`,
  },

  // ─── Step 3: Day 7 — Scheduling Constraint Urgency (9:00 AM local) ────
  {
    step: 3,
    dayOffset: 7,
    targetHour: 9,
    targetMinute: 0,
    channel: 'whatsapp',
    purpose: 'Scheduling constraint + urgency play',
    buildMessage: (ctx) =>
      `Hi ${ctx.firstName}, ${ctx.ownerName} asked me to reach out. ` +
      `We're currently finalizing the crew's schedule for the first half of next month. ` +
      `If you're looking to get this project done soon, let me know so I can hold a spot for you before the calendar fills up. 📅`,
  },

  // ─── Step 4: Day 10 — Financing / Friction Removal (2:00 PM local) ────
  {
    step: 4,
    dayOffset: 10,
    targetHour: 14,
    targetMinute: 0,
    channel: 'whatsapp',
    purpose: 'Financing / friction removal',
    buildMessage: (ctx) =>
      `Hey ${ctx.firstName}, ${ctx.ownerName} wanted me to quickly check in. ` +
      `A lot of our clients use our financing option to break up the cost — makes a ${ctx.quoteAmount} project a lot easier to budget. ` +
      `Would it be helpful if I sent over the details so you can preview the monthly payment options? (No hard credit pull) 💰`,
  },

  // ─── Step 5: Day 14 — Professional Break-Up (3:00 PM local) ───────────
  {
    step: 5,
    dayOffset: 14,
    targetHour: 15,
    targetMinute: 0,
    channel: 'whatsapp',
    purpose: 'Professional break-up (open-ended, highest reply rate)',
    buildMessage: (ctx) =>
      `Hey ${ctx.firstName}, I haven't heard back so I'll go ahead and archive your estimate so we stop bugging you! 😊 ` +
      `Just so I can update ${ctx.ownerName}'s file — did the timing just not work out, or did you guys end up going with another company? ` +
      `No worries either way, just helps us out! 🙏`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TIMEZONE & SCHEDULING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate the next send time for a given step, respecting:
 * - Target day offset from lead creation
 * - Target hour/minute in the lead's local timezone
 * - Weekend routing (delays to Monday 9 AM)
 * - Business hours guard (9 AM - 6 PM)
 *
 * For step 0 (immediate), returns 60 seconds from now.
 */
export function calculateNextActionTime(
  step: SequenceStep,
  leadCreatedAt: string | Date,
  timezone: string,
): Date {
  // Step 0 fires immediately (within 60s)
  if (step.targetHour === -1) {
    return new Date(Date.now() + 60 * 1000);
  }

  const created = new Date(leadCreatedAt);

  // Calculate the target date: created + dayOffset days
  const targetDate = new Date(created);
  targetDate.setDate(targetDate.getDate() + step.dayOffset);

  // Set the target time in the lead's timezone
  // We use Intl.DateTimeFormat to convert timezone-aware
  const targetUTC = getUTCTimeForLocal(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    step.targetHour,
    step.targetMinute,
    timezone,
  );

  // Weekend routing: if Saturday or Sunday, push to Monday same time
  const adjusted = avoidWeekend(targetUTC, step.targetHour, step.targetMinute, timezone);

  // Business hours guard: if somehow outside 9-18 local, clamp to next valid window
  return enforceBusinessHours(adjusted, timezone);
}

/**
 * Given a local date/time in a timezone, return the UTC Date.
 */
function getUTCTimeForLocal(
  year: number,
  month: number,  // 0-indexed
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Create a date string in the target timezone and parse it
  // We build an ISO-like string and use the timezone offset
  const localStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  // Use a trick: format a known UTC date in the target timezone to find the offset
  try {
    // This approach: create a date assuming UTC, then adjust by the timezone offset
    const tempDate = new Date(`${localStr}Z`); // treat as UTC first
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });

    // Get what "tempDate" looks like in target timezone
    const parts = formatter.formatToParts(tempDate);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const localHour = parseInt(getPart('hour'));
    const localMinute = parseInt(getPart('minute'));

    // The difference between what we want (hour:minute) and what we got tells us the offset
    const diffMinutes = (hour * 60 + minute) - (localHour * 60 + localMinute);
    return new Date(tempDate.getTime() + diffMinutes * 60 * 1000);
  } catch {
    // Fallback: assume UTC if timezone parsing fails
    return new Date(`${localStr}Z`);
  }
}

/**
 * If the date falls on Saturday or Sunday, push to Monday at the same local time.
 */
function avoidWeekend(utcDate: Date, targetHour: number, targetMinute: number, timezone: string): Date {
  const localDay = getLocalDayOfWeek(utcDate, timezone);

  if (localDay === 6) {
    // Saturday → push +2 days to Monday
    return getUTCTimeForLocal(
      utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate() + 2,
      targetHour, targetMinute, timezone,
    );
  }
  if (localDay === 0) {
    // Sunday → push +1 day to Monday
    return getUTCTimeForLocal(
      utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate() + 1,
      targetHour, targetMinute, timezone,
    );
  }

  return utcDate;
}

/**
 * Clamp time to 9 AM - 6 PM local. If before 9 AM, push to 9 AM. If after 6 PM, push to next day 9 AM.
 */
function enforceBusinessHours(utcDate: Date, timezone: string): Date {
  const localHour = getLocalHour(utcDate, timezone);

  if (localHour < 9) {
    // Too early — push to 9 AM same day
    const d = new Date(utcDate);
    d.setTime(d.getTime() + (9 - localHour) * 60 * 60 * 1000);
    return avoidWeekend(d, 9, 0, timezone);
  }

  if (localHour >= 18) {
    // Too late — push to 9 AM next day
    const d = new Date(utcDate);
    d.setTime(d.getTime() + (24 - localHour + 9) * 60 * 60 * 1000);
    return avoidWeekend(d, 9, 0, timezone);
  }

  return utcDate;
}

function getLocalDayOfWeek(utcDate: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  const dayStr = formatter.format(utcDate);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return dayMap[dayStr] ?? utcDate.getDay();
}

function getLocalHour(utcDate: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
  return parseInt(formatter.format(utcDate)) || 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENCE PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase } from './supabase';
import { sendWhatsApp } from './whatsapp';

export interface ProcessResult {
  action: string;
  step?: number;
  nextActionTime?: string;
}

/**
 * Load business context for a lead (name, owner, niche).
 */
export async function loadBusinessContext(businessId: string | null): Promise<{
  name?: string;
  ownerName?: string;
  ownerPhone?: string;
  niche?: string;
} | undefined> {
  if (!businessId) return undefined;
  const supabase = getSupabase();
  const { data: biz } = await supabase
    .from('businesses')
    .select('name, whatsapp_number, phone_number, business_data')
    .eq('id', businessId)
    .single();
  if (!biz) return undefined;
  const cfg = (biz.business_data || {}) as Record<string, unknown>;
  return {
    name: biz.name,
    ownerName: cfg.ownerName as string | undefined,
    ownerPhone: biz.whatsapp_number || biz.phone_number,
    niche: cfg.niche as string | undefined,
  };
}

/**
 * Process a single lead: execute the current sequence step and advance to the next.
 *
 * Returns the action taken and the next scheduled time.
 */
export async function processSequenceStep(lead: QuoteLead): Promise<ProcessResult> {
  const supabase = getSupabase();

  // ── Guard: paused, completed, or terminal status ─────────────────────
  if (lead.sequence_paused) {
    // Check if snooze period has expired
    if (lead.paused_until && new Date(lead.paused_until) <= new Date()) {
      // Resume the sequence
      await supabase.from('quote_leads').update({
        sequence_paused: false,
        paused_until: null,
      }).eq('id', lead.id);
      // Re-fetch and re-process
      const { data: refreshed } = await supabase.from('quote_leads').select('*').eq('id', lead.id).single();
      if (refreshed) return processSequenceStep(refreshed as QuoteLead);
    }
    return { action: 'paused' };
  }

  if (lead.sequence_completed || ['Booked', 'Lost'].includes(lead.status)) {
    return { action: 'terminal_status' };
  }

  // Resolve steps: custom from assistant config, or hardcoded defaults
  const steps = await resolveSequenceSteps(lead.business_id);

  const currentStep = steps[lead.sequence_step];
  if (!currentStep) {
    // All steps exhausted
    await supabase.from('quote_leads').update({
      sequence_completed: true,
      status: 'Archived',
    }).eq('id', lead.id);

    // Fire automation event
    const { fireEvent } = await import('@/lib/automations/executor');
    await fireEvent({ businessId: lead.business_id || '', event: 'sequence_completed', phone: lead.phone, customerName: lead.name, metadata: { leadId: lead.id, jobType: lead.job_type } }).catch(() => {});

    return { action: 'sequence_complete' };
  }

  // ── Load business context ────────────────────────────────────────────
  const biz = await loadBusinessContext(lead.business_id);
  const msgCtx = buildMessageContext(lead, biz);

  // ── Execute the step ─────────────────────────────────────────────────
  let action = '';

  if (currentStep.channel === 'whatsapp') {
    const message = currentStep.buildMessage(msgCtx);
    try {
      await sendWhatsApp(lead.phone, message, lead.business_id || undefined);
      action = `whatsapp_step_${currentStep.step}`;

      // Save to chat history
      await supabase.from('quote_chat_history').insert({
        lead_id: lead.id,
        role: 'assistant',
        content: message,
      });
    } catch (err) {
      console.error(`[sequence] WhatsApp failed for step ${currentStep.step}, lead ${lead.id}:`, err);
      return { action: `whatsapp_step_${currentStep.step}_failed` };
    }
  } else if (currentStep.channel === 'retell_voice') {
    // Trigger voice call via internal route
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
    try {
      const res = await fetch(`${appUrl}/api/retell/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      if (!res.ok) throw new Error(`Retell call route returned ${res.status}`);
      action = `retell_call_step_${currentStep.step}`;
      // Note: The Retell callback handler will send the missed-call text if needed
    } catch (err) {
      console.error(`[sequence] Retell call failed for step ${currentStep.step}, lead ${lead.id}:`, err);
      // Fallback: send the missed-call text directly
      const fallbackMsg = currentStep.buildMessage(msgCtx);
      try {
        await sendWhatsApp(lead.phone, fallbackMsg, lead.business_id || undefined);
        action = `retell_failed_whatsapp_fallback_step_${currentStep.step}`;
      } catch {
        return { action: `retell_call_step_${currentStep.step}_failed` };
      }
    }
  }

  // ── Advance to next step ─────────────────────────────────────────────
  const nextStepIndex = lead.sequence_step + 1;
  const nextStep = steps[nextStepIndex];

  let nextActionTime: string;
  if (nextStep) {
    const nextTime = calculateNextActionTime(nextStep, lead.created_at, lead.timezone);
    nextActionTime = nextTime.toISOString();
  } else {
    // No more steps — mark completed after a buffer period
    nextActionTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days buffer
  }

  // Update lead: advance step, set next action time
  const updatePayload: Record<string, unknown> = {
    sequence_step: nextStepIndex,
    next_action_time: nextActionTime,
    attempts: lead.attempts + 1,
  };

  // For the voice call step, update status
  if (currentStep.channel === 'retell_voice') {
    updatePayload.status = 'Called';
  }

  // If this was the last step (Day 14), mark completed + archive
  if (!nextStep) {
    updatePayload.sequence_completed = true;
    updatePayload.status = 'Archived';
  }

  await supabase.from('quote_leads').update(updatePayload).eq('id', lead.id);

  return { action, step: currentStep.step, nextActionTime };
}

// ═══════════════════════════════════════════════════════════════════════════
// STOP ON REPLY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Called when a prospect replies to any message in the sequence.
 * Immediately pauses the automated sequence so the AI negotiation
 * engine takes over. The sequence can be resumed via snooze.
 */
export async function pauseSequenceOnReply(leadId: string): Promise<void> {
  const supabase = getSupabase();

  // Load lead for context before pausing
  const { data: lead } = await supabase.from('quote_leads').select('phone, name, business_id, job_type').eq('id', leadId).maybeSingle();

  await supabase.from('quote_leads').update({
    sequence_paused: true,
    last_reply_at: new Date().toISOString(),
    status: 'WhatsApp_Nurture', // Transition to active negotiation
  }).eq('id', leadId);

  // Fire automation event
  if (lead?.business_id) {
    const { fireEvent } = await import('@/lib/automations/executor');
    await fireEvent({ businessId: lead.business_id, event: 'customer_replied', phone: lead.phone, customerName: lead.name, metadata: { leadId, jobType: lead.job_type } }).catch(() => {});
  }

  console.log(`[sequence] Paused sequence for lead ${leadId} — prospect replied`);
}

/**
 * Snooze the sequence: pause for N days, then resume from current step.
 */
export async function snoozeSequence(leadId: string, days: number): Promise<void> {
  const supabase = getSupabase();
  const resumeAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('quote_leads').update({
    sequence_paused: true,
    paused_until: resumeAt,
  }).eq('id', leadId);
  console.log(`[sequence] Snoozed lead ${leadId} for ${days} days (resume: ${resumeAt})`);
}

/**
 * Resume a paused sequence (e.g., after snooze expires or manual override).
 * Recalculates the next step's send time relative to now.
 */
export async function resumeSequence(leadId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: lead } = await supabase.from('quote_leads').select('*').eq('id', leadId).single();
  if (!lead) return;

  const typedLead = lead as QuoteLead;
  const nextStep = SEQUENCE_STEPS[typedLead.sequence_step];

  let nextActionTime: string;
  if (nextStep) {
    // Schedule the next step for the appropriate local time tomorrow
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const targetTime = getUTCTimeForLocal(
      tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(),
      nextStep.targetHour === -1 ? 9 : nextStep.targetHour,
      nextStep.targetMinute,
      typedLead.timezone,
    );
    nextActionTime = enforceBusinessHours(avoidWeekend(targetTime, nextStep.targetHour, nextStep.targetMinute, typedLead.timezone), typedLead.timezone).toISOString();
  } else {
    nextActionTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  await supabase.from('quote_leads').update({
    sequence_paused: false,
    paused_until: null,
    status: 'Open',
    next_action_time: nextActionTime,
  }).eq('id', leadId);

  console.log(`[sequence] Resumed sequence for lead ${leadId}, next action: ${nextActionTime}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// BREAKUP REPLY DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect if a reply to the Day 14 break-up message is an A/B/C choice.
 * Returns the choice letter or null.
 */
/**
 * Detect the intent behind a reply to the Day 14 break-up message.
 * Now parses natural language instead of A/B/C letter choices.
 *
 * Returns:
 *   'timing'    → Not ready yet / bad timing (snooze 30 days)
 *   'lost'      → Went with competitor (mark lost)
 *   'thinking'  → Still considering (snooze 7 days)
 *   null        → Couldn't classify — fall through to AI negotiation
 */
export function detectBreakupIntent(message: string): 'timing' | 'lost' | 'thinking' | null {
  const lower = message.trim().toLowerCase();

  // ── Lost: went with someone else ──────────────────────────────────────
  if (/went with (someone|another|a different)|found (someone|another)|hired (someone|another)|chose (someone|another)|picked (someone|another)|already (booked|got|signed|hired)|using (another|a different)|other (company|contractor|guy|team)/i.test(lower)) {
    return 'lost';
  }

  // ── Timing: not the right time ────────────────────────────────────────
  if (/timing|not (the )?right time|not ready|maybe (later|next)|down the (road|line)|few months|next (year|spring|summer|fall|winter|quarter)|hold off|put (it |this )?on hold|budget|can'?t (afford|swing)|too expensive right now|waiting (on|for) (funds|money|insurance|approval)/i.test(lower)) {
    return 'timing';
  }

  // ── Still thinking: on the fence ──────────────────────────────────────
  if (/still (thinking|deciding|considering|looking|comparing|mulling)|haven'?t decided|on the fence|weighing|not sure yet|need (more )?time|thinking about it|might (still )?do it|probably will|leaning toward/i.test(lower)) {
    return 'thinking';
  }

  // Legacy A/B/C support (in case some people still reply that way)
  const trimmedUpper = message.trim().toUpperCase();
  if (trimmedUpper === 'A') return 'timing';
  if (trimmedUpper === 'B') return 'lost';
  if (trimmedUpper === 'C') return 'thinking';

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTENT DETECTION KEYWORDS (for handoff protocol)
// ═══════════════════════════════════════════════════════════════════════════

export const INTENT_PATTERNS = {
  /** High intent — immediately alert contractor */
  highIntent: /\b(let'?s do it|ready to book|how do we start|deposit|contract|when can you start|sign me up|i'?m in|let'?s go|book it|ready to start|move forward|let'?s proceed)\b/i,
  /** Competitor trigger — went with someone else */
  competitor: /\b(went with someone|using another|already booked|found someone|hired someone|going with another)\b/i,
  /** Stop trigger — opt out */
  stop: /\b(not interested|remove me|stop texting|stop messaging|unsubscribe|leave me alone|do not contact|stop|opt out)\b/i,
  /** Snooze — not ready yet, come back later */
  snooze: /\b(not ready|give (?:me|us) (?:a |some )?(?:time|week|month)|(?:come|check|follow up|call|text) (?:back )?(?:in |next |after )?(?:a )?(?:week|month|few days|couple|2|two)|still (?:waiting|deciding|comparing|getting)|need (?:more )?time|(?:maybe |probably )?later|waiting on|other (?:quotes?|bids?|estimates?))\b/i,
} as const;

/**
 * Parse a snooze request to determine how many days to wait.
 */
export function parseSnoozeDuration(message: string): number {
  const lower = message.toLowerCase();
  if (/month/i.test(lower)) return 30;
  if (/two weeks|2 weeks|couple.?weeks/i.test(lower)) return 14;
  if (/week/i.test(lower)) return 7;
  if (/few days|couple.?days/i.test(lower)) return 5;
  // Default: 7 days
  return 7;
}
