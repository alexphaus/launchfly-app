-- 2025 Engine tables (non-breaking)

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text,
  sent_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  to_email text not null,
  subject text,
  provider text,
  provider_message_id text,
  bounce boolean default false,
  complaint boolean default false,
  suppressed boolean default false,
  clicked_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  email_id uuid references public.emails(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  dest_url text not null,
  created_at timestamptz default now()
);

create table if not exists public.email_replies (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references public.emails(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_email text,
  body text,
  sentiment text,
  created_at timestamptz default now()
);

create table if not exists public.suppression_list (
  email text primary key,
  reason text,
  created_at timestamptz default now()
);

create table if not exists public.idempotency (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  created_at timestamptz default now()
);

alter table public.businesses add column if not exists email_ramp_stage int default 0;
alter table public.businesses add column if not exists manual_approval_required boolean default true;
alter table public.businesses add column if not exists approved_at timestamptz;

-- RPC to increment campaign stats
create or replace function public.increment_campaign_stats(p_campaign_id uuid, p_sent_inc int default 1)
returns void as $$
begin
  update public.campaigns set sent_count = coalesce(sent_count,0) + coalesce(p_sent_inc,0)
  where id = p_campaign_id;
end;
$$ language plpgsql security definer;


