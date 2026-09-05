-- Migration: Copilot — safe for people who are not you
-- Makes the app multi-user: nobody sends under someone else's identity, nobody
-- sees someone else's prospect pipeline, and the copy the agent writes comes
-- from a structured offer rather than a hardcoded template.
-- Additive and idempotent. Run after 20260904_copilot_close_the_loop.sql.

-- ─── Offer: what this person actually sells ─────────────────────────────────
-- { sells, for_who, problem, price_band, proof_url }
alter table copilot_profiles add column if not exists offer jsonb not null default '{}'::jsonb;

-- ─── Sending identity ───────────────────────────────────────────────────────
-- 'manual'  = the app never sends. It hands over a pre-filled wa.me / mailto
--             link, the user sends from their own WhatsApp or mail client, and
--             taps "I sent it". Default: no impersonation, no ban risk.
-- 'api'     = the app sends directly, only possible once this profile has its
--             OWN channel (linked_business_id for WhatsApp, verified from
--             address for email).
alter table copilot_profiles add column if not exists send_mode text not null default 'manual'
  check (send_mode in ('manual', 'api'));
-- Per-profile verified sender. Null means this profile may not send email via API.
alter table copilot_profiles add column if not exists email_from text;

-- How an execution actually left: through the API, or by hand from the user's own app.
alter table copilot_executions add column if not exists dispatch text not null default 'api'
  check (dispatch in ('api', 'manual'));

-- ─── Owner-scoped prospect supply ───────────────────────────────────────────
-- The hunter adapter reads Launchfly's shared hunter_prospects table, so it is
-- only offered to profiles explicitly linked to a business (enforced in code).
-- This index keeps that lookup cheap.
create index if not exists copilot_profiles_business_idx on copilot_profiles(linked_business_id)
  where linked_business_id is not null;
