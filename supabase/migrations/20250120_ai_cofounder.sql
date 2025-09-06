-- Migration: AI Cofounder System
-- Date: 2025-01-20
-- Description: Complete lead management and AI cofounder infrastructure

-- Leads table with comprehensive tracking
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Basic information
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  title TEXT,
  industry TEXT,
  company_size TEXT,
  
  -- Lead status and scoring
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'hot', 'warm', 'lukewarm', 'cold', 'dead', 'customer')),
  score INTEGER DEFAULT 0,
  temperature TEXT DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'lukewarm', 'cold')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  
  -- Tracking
  source TEXT, -- Where the lead came from
  campaign_id TEXT,
  first_contact_date TIMESTAMP WITH TIME ZONE,
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up_date TIMESTAMP WITH TIME ZONE,
  
  -- AI insights
  ai_notes TEXT,
  pain_points TEXT[],
  interests TEXT[],
  objections TEXT[],
  
  -- Conversation state
  conversation_stage TEXT DEFAULT 'initial' CHECK (conversation_stage IN ('initial', 'discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  follow_up_count INTEGER DEFAULT 0,
  email_count INTEGER DEFAULT 0,
  
  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_lead_per_business UNIQUE (business_id, email)
);

-- Lead interactions tracking
CREATE TABLE IF NOT EXISTS lead_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN (
    'email_open', 'email_click', 'reply_received', 'meeting_booked',
    'proposal_viewed', 'website_visit', 'multiple_visits', 'downloaded_resource',
    'form_submission', 'phone_call', 'sms_reply', 'social_engagement'
  )),
  
  channel TEXT CHECK (channel IN ('email', 'phone', 'sms', 'website', 'social', 'other')),
  details JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follow-ups tracking
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('automated', 'manual', 'scheduled', 'triggered')),
  attempt_number INTEGER NOT NULL,
  cadence TEXT, -- 'aggressive', 'standard', 'gentle', 'nurture'
  
  content JSONB NOT NULL, -- {subject, body, cta}
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  response_received BOOLEAN DEFAULT FALSE,
  response_type TEXT, -- 'positive', 'negative', 'question', 'objection'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead nurturing campaigns
CREATE TABLE IF NOT EXISTS lead_nurturing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  content_type TEXT NOT NULL CHECK (content_type IN ('case_study', 'insight', 'resource', 'tip', 'news', 'offer')),
  content JSONB NOT NULL, -- {subject, preview, content, ps_message}
  
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'opened', 'clicked', 'failed')),
  engagement_score INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Cofounder reports and insights
CREATE TABLE IF NOT EXISTS ai_cofounder_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  data JSONB NOT NULL, -- Complete report data
  
  insights TEXT[], -- Key insights from AI
  recommendations TEXT[], -- AI recommendations
  metrics JSONB, -- Key metrics
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications for users
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID, -- Optional, for user-specific notifications
  
  type TEXT NOT NULL CHECK (type IN ('hot_lead', 'follow_up_due', 'response_received', 'milestone', 'alert', 'insight')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_taken BOOLEAN DEFAULT FALSE,
  action_taken_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead inbox view for organized conversation management
CREATE OR REPLACE VIEW lead_inbox AS
SELECT 
  l.*,
  COUNT(DISTINCT li.id) as interaction_count,
  MAX(li.created_at) as last_interaction,
  COUNT(DISTINCT f.id) as follow_up_count,
  MAX(f.sent_at) as last_follow_up,
  COUNT(DISTINCT ln.id) as nurturing_count,
  CASE 
    WHEN l.temperature = 'hot' THEN 1
    WHEN l.temperature = 'warm' THEN 2
    WHEN l.temperature = 'lukewarm' THEN 3
    WHEN l.temperature = 'cold' THEN 4
    ELSE 5
  END as temperature_rank
FROM leads l
LEFT JOIN lead_interactions li ON l.id = li.lead_id
LEFT JOIN follow_ups f ON l.id = f.lead_id AND f.status = 'sent'
LEFT JOIN lead_nurturing ln ON l.id = ln.lead_id AND ln.status = 'sent'
GROUP BY l.id
ORDER BY temperature_rank, l.score DESC;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_business_status ON leads(business_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(business_id, temperature);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead ON lead_interactions(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_type ON lead_interactions(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(business_id, read) WHERE read = FALSE;

-- Trigger to update lead score on new interaction
CREATE OR REPLACE FUNCTION update_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the lead's last_contact_date
  UPDATE leads 
  SET 
    last_contact_date = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.lead_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_score
AFTER INSERT ON lead_interactions
FOR EACH ROW
EXECUTE FUNCTION update_lead_score();

-- Function to auto-update lead temperature based on score
CREATE OR REPLACE FUNCTION update_lead_temperature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score >= 80 THEN
    NEW.temperature = 'hot';
  ELSIF NEW.score >= 50 THEN
    NEW.temperature = 'warm';
  ELSIF NEW.score >= 20 THEN
    NEW.temperature = 'lukewarm';
  ELSE
    NEW.temperature = 'cold';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_temperature
BEFORE UPDATE OF score ON leads
FOR EACH ROW
EXECUTE FUNCTION update_lead_temperature();
