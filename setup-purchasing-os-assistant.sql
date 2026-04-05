-- ═══════════════════════════════════════════════════════════════════════════
-- Purchasing OS — Assistant Setup
-- Run AFTER create-purchasing-os-tables.sql
--
-- Creates a "Purchasing OS" assistant for a business.
-- Replace BUSINESS_ID with the actual business UUID.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── For Launchfly (Alex's test) ──────────────────────────────────────────
-- BUSINESS_ID: 06203464-2b76-4468-8d2e-6630ab0ed71a

INSERT INTO assistants (
  business_id,
  name,
  active,
  tone,
  goal,
  system_prompt,
  knowledge_base,
  custom_rules,
  tools_enabled
) VALUES (
  '06203464-2b76-4468-8d2e-6630ab0ed71a',
  'Purchasing OS',
  true,
  'professional',
  'Extract material lists from job descriptions, draft supplier quote requests, track job readiness',
  E'You are the Purchasing Manager for this business. You have EXACTLY THREE jobs:\n\n1. SCOPE EXTRACTION: When the owner or a technician sends a message about a job (text, voice transcript, or photo description), extract a structured materials list. Identify: job name, client/address if mentioned, materials needed with quantities, and any blockers (permits, approvals, schedule conflicts).\n\n2. SUPPLIER COORDINATION: When asked, draft a short WhatsApp message to a supplier requesting availability and pricing for a materials list. Query the suppliers table to find the right contacts.\n\n3. JOB STATUS: Track which jobs are ready to start vs blocked. A job is READY when all materials are confirmed and no blockers remain. A job is BLOCKED when materials are missing or approvals are pending.\n\nYou do NOT handle customer inquiries. You do NOT book appointments. You do NOT do marketing.\n\nWhen you extract a materials list, ALWAYS:\n- Save it as a job using the manage_job tool\n- Confirm back in this format:\n\n✅ *[Job Name] — Materials Logged*\n📋 Needed:\n• [qty] × [item]\n• [qty] × [item]\n🚫 Blockers: [list any, or \"None\"]\n\nReply YES to send quote requests to your suppliers, or EDIT to correct.',
  '{}',
  ARRAY['Extract materials from voice notes and text', 'Draft supplier quote request messages in WhatsApp format', 'Track job status: draft → quoting → ready → blocked → completed', 'Flag missing materials or pending approvals as blockers', 'Query past jobs to estimate costs based on history'],
  ARRAY['bookings', 'sendVoiceNote']
) ON CONFLICT DO NOTHING;

-- ── Example: Insert test suppliers for Launchfly ─────────────────────────
-- (Delete these and add real ones for actual clients)

INSERT INTO suppliers (business_id, name, whatsapp_number, category, notes) VALUES
  ('06203464-2b76-4468-8d2e-6630ab0ed71a', 'Test Supplier A', '+639627459049', 'general', 'Test supplier - Alex phone'),
  ('06203464-2b76-4468-8d2e-6630ab0ed71a', 'Test Supplier B', '+639627459049', 'general', 'Test supplier - Alex phone')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════
-- To set up for a NEW client (e.g., HVAC contractor), run:
--
-- INSERT INTO assistants (business_id, name, active, tone, goal, system_prompt, ...)
-- VALUES ('CLIENT_BUSINESS_ID', 'Purchasing OS', true, 'professional', ...);
--
-- INSERT INTO suppliers (business_id, name, whatsapp_number, category)
-- VALUES ('CLIENT_BUSINESS_ID', 'Johnstone Supply', '+1...', 'hvac');
-- ══════════════════════════════════════════════════════════════════════════
