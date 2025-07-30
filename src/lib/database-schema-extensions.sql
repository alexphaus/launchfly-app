-- Future-Proof Launchfly Database Schema Extensions
-- Add these tables to support the new core system

-- Market intelligence storage (AI-resistant moat)
CREATE TABLE public.market_intelligence (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_skills text NOT NULL,
  business_type text NOT NULL,
  opportunity_analysis jsonb NOT NULL,
  success_probability jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Business success tracking
CREATE TABLE public.business_success_tracking (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  session_id text NOT NULL,
  success_probability integer NOT NULL,
  acquisition_plan jsonb NOT NULL,
  growth_plan jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Growth experiments and optimization
CREATE TABLE public.growth_experiments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  experiment_id text NOT NULL,
  experiment_name text NOT NULL,
  experiment_type text NOT NULL,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'failed')),
  result jsonb,
  impact_score numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Growth tracking for continuous optimization
CREATE TABLE public.growth_tracking (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  session_id text NOT NULL,
  target_revenue numeric NOT NULL,
  optimization_schedule jsonb NOT NULL,
  next_review timestamp with time zone NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Business tracking for performance metrics
CREATE TABLE public.business_tracking (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  session_id text NOT NULL,
  website_url text,
  acquisition_channels text[],
  conversion_goals text[],
  visitors integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  marketing_spend numeric DEFAULT 0,
  new_customers integer DEFAULT 0,
  orders integer DEFAULT 0,
  tracking_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

-- Success guarantees system
CREATE TABLE public.success_guarantees (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  session_id text NOT NULL,
  guarantee_type text NOT NULL,
  target text NOT NULL,
  deadline timestamp with time zone NOT NULL,
  actions text[],
  status text DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'expired')),
  created_at timestamp with time zone DEFAULT now(),
  fulfilled_at timestamp with time zone
);

-- Customer acquisition tracking
CREATE TABLE public.customer_acquisition (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  channel text NOT NULL,
  campaign_name text,
  cost numeric DEFAULT 0,
  customers_acquired integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_market_intelligence_skills ON public.market_intelligence(user_skills);
CREATE INDEX idx_market_intelligence_type ON public.market_intelligence(business_type);
CREATE INDEX idx_business_success_tracking_business_id ON public.business_success_tracking(business_id);
CREATE INDEX idx_growth_experiments_business_id ON public.growth_experiments(business_id);
CREATE INDEX idx_growth_experiments_status ON public.growth_experiments(status);
CREATE INDEX idx_growth_tracking_business_id ON public.growth_tracking(business_id);
CREATE INDEX idx_growth_tracking_status ON public.growth_tracking(status);
CREATE INDEX idx_business_tracking_business_id ON public.business_tracking(business_id);
CREATE INDEX idx_business_tracking_date ON public.business_tracking(tracking_date);
CREATE INDEX idx_success_guarantees_business_id ON public.success_guarantees(business_id);
CREATE INDEX idx_success_guarantees_status ON public.success_guarantees(status);
CREATE INDEX idx_customer_acquisition_business_id ON public.customer_acquisition(business_id);
CREATE INDEX idx_customer_acquisition_channel ON public.customer_acquisition(channel);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE public.market_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_success_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_guarantees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_acquisition ENABLE ROW LEVEL SECURITY;

-- Update existing businesses table to support new features
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS optimizations_applied jsonb,
ADD COLUMN IF NOT EXISTS last_optimization timestamp with time zone,
ADD COLUMN IF NOT EXISTS success_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS acquisition_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_value numeric DEFAULT 0;

-- Update sessions table to support enhanced progress tracking
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS stage_message text,
ADD COLUMN IF NOT EXISTS success_probability integer DEFAULT 0;
