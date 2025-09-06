-- supabase/migrations/20250821_adaptive_ai_agent.sql

-- 1. Enable pgvector extension for similarity search
create extension if not exists vector;

-- 2. AI Agent Plans Table
-- Stores the high-level objective for a business's AI agent
create table if not exists ai_plans (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references businesses(id) on delete cascade not null,
    objective text not null,
    status text default 'pending', -- pending, in_progress, completed, failed
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_ai_plans_business_id on ai_plans(business_id);
create index if not exists idx_ai_plans_status on ai_plans(status);

-- 3. AI Agent Tasks Table
-- Stores the individual, sequential tasks that make up a plan
create table if not exists ai_tasks (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid references ai_plans(id) on delete cascade not null,
    business_id uuid references businesses(id) on delete cascade not null,
    description text not null,
    tool_to_call text, -- e.g., 'findProspects', 'launchOutreachCampaign'
    tool_params jsonb,
    status text default 'pending', -- pending, in_progress, completed, failed, waiting_for_dependency
    result jsonb,
    priority integer default 0,
    parent_task_id uuid references ai_tasks(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);

create index if not exists idx_ai_tasks_plan_id on ai_tasks(plan_id);
create index if not exists idx_ai_tasks_status on ai_tasks(status);
create index if not exists idx_ai_tasks_priority on ai_tasks(priority);

-- 4. AI Agent Memory Table
-- Stores learnings and contextual information as vector embeddings
create table if not exists ai_memories (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references businesses(id) on delete cascade not null,
    content text not null,
    embedding vector(1536), -- OpenAI text-embedding-ada-002 model
    source text, -- e.g., 'competitor_analysis', 'successful_email_copy'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_ai_memories_business_id on ai_memories(business_id);
-- Create an IVFFlat index for fast similarity search
create index on ai_memories using ivfflat (embedding vector_l2_ops) with (lists = 100);

-- 5. Add columns to businesses table for the new agent
alter table businesses
add column if not exists adaptive_agent_enabled boolean default false,
add column if not exists current_plan_id uuid references ai_plans(id);

-- RLS Policies for new tables
-- (Assuming you have RLS enabled, otherwise these will not apply)

-- AI Plans
alter table ai_plans enable row level security;
drop policy if exists "Allow full access to own plans" on ai_plans;
create policy "Allow full access to own plans" on ai_plans for all
    using (auth.uid() = (select user_id from businesses where id = business_id));

-- AI Tasks
alter table ai_tasks enable row level security;
drop policy if exists "Allow full access to own tasks" on ai_tasks;
create policy "Allow full access to own tasks" on ai_tasks for all
    using (auth.uid() = (select user_id from businesses where id = business_id));

-- AI Memories
alter table ai_memories enable row level security;
drop policy if exists "Allow full access to own memories" on ai_memories;
create policy "Allow full access to own memories" on ai_memories for all
    using (auth.uid() = (select user_id from businesses where id = business_id));

-- Function to perform similarity search on memories
create or replace function match_memories (
  query_embedding vector(1536),
  p_business_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    ai_memories.id,
    ai_memories.content,
    1 - (ai_memories.embedding <=> query_embedding) as similarity
  from ai_memories
  where 1 - (ai_memories.embedding <=> query_embedding) > match_threshold
  and ai_memories.business_id = p_business_id
  order by similarity desc
  limit match_count;
$$;
