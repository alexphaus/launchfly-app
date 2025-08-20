-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_activities (
  business_id uuid NOT NULL,
  type character varying NOT NULL,
  icon character varying,
  message text NOT NULL,
  details text,
  metadata jsonb,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_activities_pkey PRIMARY KEY (id),
  CONSTRAINT ai_activities_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.businesses (
  guarantee_start_at timestamp with time zone,
  first_payment_at timestamp with time zone,
  guarantee_48h_status text DEFAULT 'pending'::text CHECK (guarantee_48h_status = ANY (ARRAY['pending'::text, 'met'::text, 'missed'::text, 'paid'::text])),
  guarantee_60d_status text DEFAULT 'pending'::text CHECK (guarantee_60d_status = ANY (ARRAY['pending'::text, 'met'::text, 'extended'::text, 'failed'::text])),
  guarantee_last_checked_at timestamp with time zone,
  guarantee_48h_payout_id text,
  guarantee_48h_payout_amount numeric DEFAULT 100,
  plan_tier text DEFAULT 'starter'::text CHECK (plan_tier = ANY (ARRAY['starter'::text, 'pro'::text, 'scale'::text])),
  rev_share_percent numeric DEFAULT 0,
  stripe_connect_account_id text,
  work_free_mode boolean DEFAULT false,
  last_sale_date timestamp with time zone,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'generating'::text, 'ready'::text, 'failed'::text])),
  user_id uuid NOT NULL,
  name text NOT NULL,
  subdomain text NOT NULL UNIQUE,
  session_id text UNIQUE,
  phone_number text,
  launch_date timestamp with time zone,
  form_data jsonb NOT NULL,
  business_data jsonb,
  completed_onboarding boolean DEFAULT false,
  trial_ends_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  views integer DEFAULT 0,
  first_sale_date timestamp with time zone,
  total_revenue numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  model text,
  assets jsonb,
  strategy_plan jsonb,
  growth_data jsonb,
  latest_campaign_review jsonb,
  latest_email_campaign jsonb,
  latest_email_batch jsonb,
  opportunity_data jsonb,
  total_leads integer DEFAULT 0,
  total_visitors integer DEFAULT 0,
  projected_revenue numeric DEFAULT 0,
  last_growth_campaign_at timestamp with time zone,
  email_ramp_stage integer DEFAULT 0,
  manual_approval_required boolean DEFAULT true,
  approved_at timestamp with time zone,
  ai_objections_handled integer DEFAULT 0,
  ai_response_rate numeric DEFAULT 0.00,
  ai_conversation_count integer DEFAULT 0,
  CONSTRAINT businesses_pkey PRIMARY KEY (id),
  CONSTRAINT businesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.campaigns (
  business_id uuid NOT NULL,
  name text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sent_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.clicks (
  slug text NOT NULL UNIQUE,
  email_id uuid,
  business_id uuid NOT NULL,
  campaign_id uuid,
  dest_url text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clicks_pkey PRIMARY KEY (id),
  CONSTRAINT clicks_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id),
  CONSTRAINT clicks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT clicks_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.email_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  business_id uuid NOT NULL,
  prospect_email text NOT NULL,
  message_type text NOT NULL CHECK (message_type = ANY (ARRAY['initial'::text, 'objection'::text, 'ai_response'::text, 'follow_up'::text])),
  content text NOT NULL,
  objection_type text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT email_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.email_outreach (
  business_id uuid,
  prospect_id character varying NOT NULL,
  email_type character varying NOT NULL,
  subject character varying,
  content text,
  sent_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status character varying DEFAULT 'sent'::character varying,
  response_received boolean DEFAULT false,
  meeting_scheduled boolean DEFAULT false,
  converted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_outreach_pkey PRIMARY KEY (id),
  CONSTRAINT email_outreach_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.email_replies (
  email_id uuid,
  business_id uuid NOT NULL,
  from_email text,
  body text,
  sentiment text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_replies_pkey PRIMARY KEY (id),
  CONSTRAINT email_replies_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT email_replies_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id)
);
CREATE TABLE public.emails (
  business_id uuid NOT NULL,
  campaign_id uuid,
  to_email text NOT NULL,
  subject text,
  provider text,
  provider_message_id text,
  clicked_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bounce boolean DEFAULT false,
  complaint boolean DEFAULT false,
  suppressed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT emails_pkey PRIMARY KEY (id),
  CONSTRAINT emails_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT emails_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.follow_up_tasks (
  business_id uuid NOT NULL,
  prospect_email text NOT NULL,
  objection_type text,
  follow_up_date timestamp with time zone NOT NULL,
  notes text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follow_up_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT follow_up_tasks_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.fulfillment_content (
  sale_id uuid NOT NULL,
  content_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  last_accessed_at timestamp with time zone,
  expires_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb DEFAULT '{}'::jsonb,
  access_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillment_content_pkey PRIMARY KEY (id),
  CONSTRAINT fulfillment_content_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);
CREATE TABLE public.fulfillment_feedback (
  sale_id uuid NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  improvement_suggestions text,
  would_recommend boolean,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillment_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT fulfillment_feedback_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);
CREATE TABLE public.fulfillment_followups (
  sale_id uuid NOT NULL,
  follow_up_type text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  response_content text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'completed'::text, 'skipped'::text])),
  response_received boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillment_followups_pkey PRIMARY KEY (id),
  CONSTRAINT fulfillment_followups_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);
CREATE TABLE public.fulfillments (
  sale_id uuid NOT NULL,
  fulfillment_type text NOT NULL,
  completed_at timestamp with time zone,
  error_message text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  delivered_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_value numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillments_pkey PRIMARY KEY (id),
  CONSTRAINT fulfillments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);
CREATE TABLE public.growth_experiments (
  business_id uuid,
  experiment_type character varying NOT NULL,
  experiment_data jsonb NOT NULL,
  completed_at timestamp with time zone,
  results jsonb,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status character varying DEFAULT 'running'::character varying,
  started_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT growth_experiments_pkey PRIMARY KEY (id),
  CONSTRAINT growth_experiments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.growth_sessions (
  business_id uuid NOT NULL,
  campaign_type text NOT NULL,
  completed_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'failed'::text])),
  started_at timestamp with time zone DEFAULT now(),
  metrics jsonb DEFAULT '{"conversions": 0, "leads_generated": 0, "revenue_generated": 0}'::jsonb,
  CONSTRAINT growth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT growth_sessions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.idempotency (
  key text NOT NULL UNIQUE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT idempotency_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inngest_jobs (
  business_id uuid,
  job_type character varying NOT NULL,
  event_name character varying NOT NULL,
  event_data jsonb NOT NULL,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status character varying DEFAULT 'queued'::character varying,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inngest_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT inngest_jobs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.marketing_campaigns (
  business_id uuid,
  campaign_data jsonb NOT NULL,
  channel character varying NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status character varying DEFAULT 'active'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.outreach_campaigns (
  business_id uuid NOT NULL,
  campaign_type text NOT NULL,
  email_templates jsonb,
  last_batch_sent_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text])),
  total_prospects integer DEFAULT 0,
  metrics jsonb DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "replied": 0}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT outreach_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone_number text,
  plan text DEFAULT 'trial'::text CHECK (plan = ANY (ARRAY['trial'::text, 'starter'::text, 'growth'::text, 'scale'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.prospects (
  business_id uuid NOT NULL,
  name character varying,
  email character varying,
  company character varying,
  industry character varying,
  company_size character varying,
  linkedin_url text,
  title character varying,
  source character varying,
  contacted_at timestamp with time zone,
  last_response_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status character varying DEFAULT 'discovered'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  platform text CHECK (platform = ANY (ARRAY['reddit'::text, 'facebook'::text, 'linkedin'::text, 'twitter'::text, 'instagram'::text, 'email'::text])),
  platform_username text,
  platform_user_id text,
  profile_url text,
  engagement_score integer DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  conversion_status text DEFAULT 'discovered'::text CHECK (conversion_status = ANY (ARRAY['discovered'::text, 'contacted'::text, 'engaged'::text, 'qualified'::text, 'converted'::text, 'lost'::text])),
  last_engagement timestamp with time zone,
  contact_attempts integer DEFAULT 0,
  notes text,
  tags ARRAY,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_objection_type text,
  last_ai_response text,
  objection_count integer DEFAULT 0,
  conversation_count integer DEFAULT 0,
  CONSTRAINT prospects_pkey PRIMARY KEY (id),
  CONSTRAINT prospects_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.sales (
  business_id uuid,
  product_id text,
  amount numeric NOT NULL,
  customer_email text,
  customer_name text,
  stripe_session_id text UNIQUE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  currency text DEFAULT 'usd'::text,
  payment_status text DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.sessions (
  id text NOT NULL,
  business_id uuid,
  phone_number text,
  stage text DEFAULT 'initializing'::text CHECK (stage = ANY (ARRAY['pending'::text, 'initializing'::text, 'analyzing'::text, 'researching'::text, 'building'::text, 'generating'::text, 'finalizing'::text, 'complete'::text, 'error'::text])),
  progress integer DEFAULT 0,
  completed_steps ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  inngest_job_id uuid,
  completed_at timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_inngest_job_id_fkey FOREIGN KEY (inngest_job_id) REFERENCES public.inngest_jobs(id),
  CONSTRAINT sessions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.social_actions (
  business_id uuid NOT NULL,
  campaign_id uuid,
  prospect_id uuid,
  platform text NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['post'::text, 'comment'::text, 'dm'::text, 'like'::text, 'follow'::text, 'connect'::text, 'join_group'::text, 'message'::text])),
  content text,
  target_url text,
  target_user text,
  response_sentiment text CHECK (response_sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text])),
  error_message text,
  completed_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_status text DEFAULT 'pending'::text CHECK (action_status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'rate_limited'::text])),
  response_received boolean DEFAULT false,
  conversion_generated boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_actions_pkey PRIMARY KEY (id),
  CONSTRAINT social_actions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.social_campaigns(id),
  CONSTRAINT social_actions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT social_actions_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id)
);
CREATE TABLE public.social_campaigns (
  business_id uuid NOT NULL,
  platforms ARRAY NOT NULL,
  estimated_first_sale text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])),
  estimated_reach integer DEFAULT 0,
  estimated_conversions integer DEFAULT 0,
  campaign_settings jsonb DEFAULT '{}'::jsonb,
  performance_metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT social_campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.social_monitoring (
  business_id uuid NOT NULL,
  platform text NOT NULL,
  keyword text NOT NULL,
  location text,
  last_checked timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  monitoring_type text DEFAULT 'keyword'::text CHECK (monitoring_type = ANY (ARRAY['keyword'::text, 'hashtag'::text, 'mention'::text, 'competitor'::text])),
  is_active boolean DEFAULT true,
  results_found integer DEFAULT 0,
  opportunities_created integer DEFAULT 0,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_monitoring_pkey PRIMARY KEY (id),
  CONSTRAINT social_monitoring_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.social_platform_accounts (
  business_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['reddit'::text, 'facebook'::text, 'linkedin'::text, 'twitter'::text, 'instagram'::text])),
  account_username text NOT NULL,
  account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  last_action_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_status text DEFAULT 'active'::text CHECK (account_status = ANY (ARRAY['active'::text, 'suspended'::text, 'rate_limited'::text, 'error'::text])),
  daily_action_count integer DEFAULT 0,
  daily_action_limit integer DEFAULT 100,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_platform_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT social_platform_accounts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.suppression_list (
  email text NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT suppression_list_pkey PRIMARY KEY (email)
);