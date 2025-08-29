-- Create table for onboarding analytics events
create table if not exists public.onboarding_analytics (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event_name text not null,
  event_properties jsonb not null default '{}',
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_onboarding_analytics_session on public.onboarding_analytics (session_id);
create index if not exists idx_onboarding_analytics_event_name on public.onboarding_analytics (event_name);
create index if not exists idx_onboarding_analytics_timestamp on public.onboarding_analytics (timestamp desc);

-- Row Level Security (optional, allow service role inserts)
alter table public.onboarding_analytics enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'onboarding_analytics' 
      and policyname = 'allow_inserts_for_service_role'
  ) then
    create policy "allow_inserts_for_service_role" on public.onboarding_analytics
      for insert
      to authenticated, service_role
      with check (true);
  end if;
end $$;


