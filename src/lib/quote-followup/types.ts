// src/lib/quote-followup/types.ts
// ─── Database Schema & Shared Types for Quote Follow-Up System ───

/** Lead lifecycle states */
export type LeadStatus =
  | 'Open'            // Quote received, waiting 48h
  | 'Called'           // Retell voice call attempted
  | 'WhatsApp_Nurture' // Moved to WhatsApp negotiation
  | 'Booked'          // Deposit paid / job booked
  | 'Lost';           // Lead did not convert

/** Inbound webhook payload from quoting tool */
export interface NewQuotePayload {
  name: string;
  phone: string;          // E.164 format, e.g. "+1234567890"
  quote_amount: number;
  job_type: string;
  contractor_id?: string; // optional multi-tenant key (legacy)
  business_id?: string;   // FK to businesses table (preferred)
  email?: string;
  currency?: string;      // e.g. "USD", "RM" (default: USD)
}

/** Row shape returned from / written to `quote_leads` */
export interface QuoteLead {
  id: string;                 // uuid
  name: string;
  phone: string;
  email: string | null;
  quote_amount: number;
  job_type: string;
  contractor_id: string | null;
  business_id: string | null;   // FK to businesses table
  status: LeadStatus;
  call_sid: string | null;    // Retell call id
  call_outcome: string | null;
  whatsapp_thread_id: string | null;
  stripe_payment_link: string | null;
  next_action_time: string;   // ISO-8601
  retell_call_id: string | null;
  attempts: number;
  currency: string;           // USD, RM, etc.
  created_at: string;
  updated_at: string;
}

/** Retell AI create-call request body */
export interface RetellCreateCallPayload {
  from_number: string;
  to_number: string;
  agent_id: string;
  retell_llm_dynamic_variables: Record<string, string>;
  metadata?: Record<string, string>;
}

/** Shape of a WhatsApp inbound message from Twilio */
export interface TwilioWhatsAppInbound {
  From: string;        // "whatsapp:+1234567890"
  To: string;
  Body: string;
  MessageSid: string;
  ProfileName?: string;
}

/** Chat history row for WhatsApp conversation */
export interface ChatMessage {
  id: string;
  lead_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}
