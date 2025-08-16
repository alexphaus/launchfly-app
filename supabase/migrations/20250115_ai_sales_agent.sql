-- Migration: AI Sales Agent Tables
-- Date: 2025-01-15
-- Description: Add tables for AI sales agent objection handling

-- Email conversations table to track multi-turn conversations
CREATE TABLE IF NOT EXISTS email_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  prospect_email TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('initial', 'objection', 'ai_response', 'follow_up')),
  content TEXT NOT NULL,
  objection_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_conversations_business_prospect 
ON email_conversations(business_id, prospect_email);

CREATE INDEX IF NOT EXISTS idx_email_conversations_created_at 
ON email_conversations(created_at);

-- Follow-up tasks table for scheduling future outreach
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  prospect_email TEXT NOT NULL,
  objection_type TEXT,
  follow_up_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'failed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for follow-up tasks
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_business_date 
ON follow_up_tasks(business_id, follow_up_date);

CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_status 
ON follow_up_tasks(status);

-- Add columns to prospects table for objection handling
ALTER TABLE prospects 
ADD COLUMN IF NOT EXISTS last_objection_type TEXT,
ADD COLUMN IF NOT EXISTS last_ai_response TEXT,
ADD COLUMN IF NOT EXISTS objection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversation_count INTEGER DEFAULT 0;

-- Add columns to businesses table for AI sales agent stats
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS ai_objections_handled INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_response_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS ai_conversation_count INTEGER DEFAULT 0;

-- Function to update objection count
CREATE OR REPLACE FUNCTION increment_objection_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'objection' THEN
    UPDATE prospects 
    SET objection_count = objection_count + 1,
        last_objection_type = NEW.objection_type,
        updated_at = NOW()
    WHERE email = NEW.prospect_email 
    AND business_id = NEW.business_id;
  END IF;
  
  IF NEW.message_type IN ('objection', 'ai_response') THEN
    UPDATE prospects 
    SET conversation_count = conversation_count + 1,
        updated_at = NOW()
    WHERE email = NEW.prospect_email 
    AND business_id = NEW.business_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update objection counts
CREATE TRIGGER trigger_increment_objection_count
  AFTER INSERT ON email_conversations
  FOR EACH ROW
  EXECUTE FUNCTION increment_objection_count();

-- Function to update business AI stats
CREATE OR REPLACE FUNCTION update_business_ai_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update AI objections handled count
  UPDATE businesses 
  SET ai_objections_handled = (
    SELECT COUNT(*) 
    FROM email_conversations ec
    WHERE ec.business_id = NEW.business_id 
    AND ec.message_type = 'objection'
  ),
  ai_conversation_count = (
    SELECT COUNT(*) 
    FROM email_conversations ec
    WHERE ec.business_id = NEW.business_id 
    AND ec.message_type IN ('objection', 'ai_response')
  ),
  updated_at = NOW()
  WHERE id = NEW.business_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update business AI stats
CREATE TRIGGER trigger_update_business_ai_stats
  AFTER INSERT ON email_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_business_ai_stats();

-- RLS policies for email_conversations
ALTER TABLE email_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email conversations" ON email_conversations
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE session_id IN (
        SELECT session_id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own email conversations" ON email_conversations
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE session_id IN (
        SELECT session_id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );

-- RLS policies for follow_up_tasks
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follow-up tasks" ON follow_up_tasks
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE session_id IN (
        SELECT session_id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own follow-up tasks" ON follow_up_tasks
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE session_id IN (
        SELECT session_id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own follow-up tasks" ON follow_up_tasks
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM businesses WHERE session_id IN (
        SELECT session_id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );
