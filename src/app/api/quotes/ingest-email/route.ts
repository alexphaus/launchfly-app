// src/app/api/quotes/ingest-email/route.ts
// ─── Zero-Integration BCC Email Parser ───
// Receives forwarded/BCC'd quote emails (via SendGrid Inbound Parse, Mailgun, or Postmark),
// extracts customer name, phone, and quote amount using OpenAI, then creates the lead.
//
// Setup:
//   1. Configure inbound mail provider to POST to this URL.
//   2. Map the contractor's BCC address to their business_id via `email_ingest_mappings`.
//   3. The contractor just BCCs quotes@yourapp.com on every quote email — done!

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabase } from '@/lib/quote-followup/supabase';
import { fireEvent } from '@/lib/automations/executor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Types ────────────────────────────────────────────────────────────────
interface ParsedQuote {
  name: string | null;
  phone: string | null;
  email: string | null;
  quote_amount: number | null;
  job_type: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface InboundEmail {
  from: string;         // sender email address
  to: string;           // recipient (our ingest address)
  subject: string;
  text?: string;        // plain text body
  html?: string;        // HTML body  
  attachments?: string; // JSON string of attachments (we use text for now)
}

// ── POST handler ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Most inbound email services POST form-urlencoded or multipart/form-data
    let emailData: InboundEmail;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      emailData = (await req.json()) as InboundEmail;
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      emailData = {
        from: (formData.get('from') || formData.get('sender') || formData.get('From') || '') as string,
        to: (formData.get('to') || formData.get('recipient') || formData.get('To') || '') as string,
        subject: (formData.get('subject') || formData.get('Subject') || '') as string,
        text: (formData.get('text') || formData.get('body-plain') || formData.get('TextBody') || '') as string,
        html: (formData.get('html') || formData.get('body-html') || formData.get('HtmlBody') || '') as string,
      };
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }

    console.log(`[ingest-email] From: ${emailData.from}, Subject: ${emailData.subject}`);

    const supabase = getSupabase();

    // ── Resolve contractor → business_id ─────────────────────────────────
    // We store a mapping from the contractor's email → business_id in the
    // businesses table's business_data JSON (field: ingest_email).
    // If the contractor forwards from their email, we match on `from`.
    // If they BCC to a unique address like quotes+<subdomain>@app.com, we match on `to`.

    // Strategy 1: Match sender email to a business
    const senderEmail = extractEmail(emailData.from);
    let businessId: string | null = null;
    let businessCurrency = 'USD';
    let businessName: string | undefined;
    let ownerName: string | undefined;
    let niche: string | undefined;

    if (senderEmail) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name, business_data')
        .or(`email.eq.${senderEmail},owner_email.eq.${senderEmail}`)
        .limit(1)
        .maybeSingle();

      if (biz) {
        businessId = biz.id;
        businessName = biz.name;
        const cfg = (biz.business_data || {}) as Record<string, unknown>;
        businessCurrency = (cfg.currency as string) || 'USD';
        ownerName = cfg.ownerName as string | undefined;
        niche = cfg.niche as string | undefined;
      }
    }

    // Strategy 2: Match +subdomain in the TO address (e.g., quotes+mikes-roofing@app.com)
    if (!businessId) {
      const plusMatch = emailData.to.match(/\+([a-zA-Z0-9_-]+)@/);
      if (plusMatch) {
        const subdomain = plusMatch[1].toLowerCase();
        const { data: biz } = await supabase
          .from('businesses')
          .select('id, name, business_data')
          .eq('subdomain', subdomain)
          .single();

        if (biz) {
          businessId = biz.id;
          businessName = biz.name;
          const cfg = (biz.business_data || {}) as Record<string, unknown>;
          businessCurrency = (cfg.currency as string) || 'USD';
          ownerName = cfg.ownerName as string | undefined;
          niche = cfg.niche as string | undefined;
        }
      }
    }

    if (!businessId) {
      console.warn(`[ingest-email] Could not resolve business for sender: ${senderEmail}`);
      return NextResponse.json(
        { error: 'Could not match sender to a registered business. Make sure the email is registered.' },
        { status: 422 }
      );
    }

    // ── Extract quote data with OpenAI ───────────────────────────────────
    const emailBody = emailData.text || stripHtml(emailData.html || '') || '';
    if (!emailBody || emailBody.trim().length < 20) {
      return NextResponse.json({ error: 'Email body too short to parse' }, { status: 422 });
    }

    const parsed = await extractQuoteFromEmail(emailBody, emailData.subject, niche);

    if (!parsed.phone) {
      console.warn('[ingest-email] No phone number found in email');
      return NextResponse.json(
        { error: 'Could not extract a phone number from the email. Please ensure the quote contains the customer\'s phone.' },
        { status: 422 }
      );
    }

    if (!parsed.quote_amount) {
      console.warn('[ingest-email] No quote amount found in email');
      return NextResponse.json(
        { error: 'Could not extract a quote amount from the email.' },
        { status: 422 }
      );
    }

    // ── Trigger the flexible executor rules ────────────────────
    const leadPayload = {
      name: parsed.name || 'Customer',
      phone: parsed.phone,
      email: parsed.email || undefined,
      quote_amount: parsed.quote_amount,
      job_type: parsed.job_type || niche || 'Home Service',
      business_id: businessId,
      currency: businessCurrency,
    };

    const triggerResult = await fireEvent({
      businessId: businessId,
      event: 'quote_sent',
      phone: leadPayload.phone,
      customerName: leadPayload.name,
      amount: leadPayload.quote_amount,
      metadata: { 
        quoteAmount: leadPayload.quote_amount, 
        jobType: leadPayload.job_type,
        email: leadPayload.email,
        currency: leadPayload.currency
      }
    });

    console.log(`[ingest-email] Triggered executor rules:`, triggerResult);

    return NextResponse.json({
      ok: true,
      parsed: {
        name: parsed.name,
        phone: parsed.phone,
        quote_amount: parsed.quote_amount,
        job_type: parsed.job_type,
        confidence: parsed.confidence,
      },
      rulesFired: triggerResult.fired,
      business: { id: businessId, name: businessName },
    }, { status: 201 });

  } catch (err) {
    console.error('[ingest-email] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── OpenAI: Extract structured data from email text ──────────────────────
async function extractQuoteFromEmail(
  body: string,
  subject: string,
  niche?: string,
): Promise<ParsedQuote> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const openai = new OpenAI({ apiKey });

  const truncatedBody = body.slice(0, 4000); // Keep within token limits

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a data extraction assistant. Extract structured quote information from contractor emails.
Return a JSON object with these fields:
- name: string | null (customer/homeowner name)
- phone: string | null (customer phone in E.164 format like +1234567890; if you see a local format like 012-345-6789 without country code, assume +1 for US or +60 for Malaysian format starting with 0)
- email: string | null (customer email if found)
- quote_amount: number | null (the total quoted price as a number, no currency symbols)
- job_type: string | null (type of job/service, e.g., "Kitchen Remodel", "Roof Repair"${niche ? `. The business is in the "${niche}" niche.` : ''})
- confidence: "high" | "medium" | "low" (how confident you are in the extraction)

Rules:
- Extract ONLY from the provided text. Do NOT invent data.
- If a field is ambiguous or missing, set it to null.
- For quote_amount, look for dollar signs, "total", "estimate", "quote" near numbers.
- For phone, look for 10+ digit numbers, formatted numbers, or "cell"/"mobile"/"phone" labels.
- If there are multiple amounts, use the grand total or final amount.`,
      },
      {
        role: 'user',
        content: `Subject: ${subject}\n\n${truncatedBody}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() || '{}';

  try {
    return JSON.parse(raw) as ParsedQuote;
  } catch {
    console.error('[ingest-email] Failed to parse OpenAI response:', raw);
    return { name: null, phone: null, email: null, quote_amount: null, job_type: null, confidence: 'low' };
  }
}

// ── Utility: extract email address from "Name <email>" format ────────────
function extractEmail(from: string): string | null {
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  if (from.includes('@')) return from.trim().toLowerCase();
  return null;
}

// ── Utility: crude HTML → text ───────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
