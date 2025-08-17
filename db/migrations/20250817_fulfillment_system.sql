-- Fulfillment System Database Schema
-- Add these tables to support the universal fulfillment core

-- Table to store fulfillment records
CREATE TABLE fulfillments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  fulfillment_type text NOT NULL, -- 'personalized_guidance', 'service_starter', etc.
  delivered_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_value numeric DEFAULT 0,
  completed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillments_pkey PRIMARY KEY (id)
);

-- Table to store generated content for customers
CREATE TABLE fulfillment_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  content_type text NOT NULL, -- 'personalized_routine', 'business_audit', etc.
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  access_count integer DEFAULT 0,
  last_accessed_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillment_content_pkey PRIMARY KEY (id)
);

-- Table to track follow-up communications
CREATE TABLE fulfillment_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  follow_up_type text NOT NULL, -- 'satisfaction_check', 'implementation_support', etc.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'skipped')),
  scheduled_for timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  response_received boolean DEFAULT false,
  response_content text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillment_followups_pkey PRIMARY KEY (id)
);

-- Table to track customer satisfaction and feedback
CREATE TABLE fulfillment_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  improvement_suggestions text,
  would_recommend boolean,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fulfillment_feedback_pkey PRIMARY KEY (id)
);

-- Add indexes for performance
CREATE INDEX idx_fulfillments_sale_id ON fulfillments(sale_id);
CREATE INDEX idx_fulfillments_status ON fulfillments(status);
CREATE INDEX idx_fulfillment_content_sale_id ON fulfillment_content(sale_id);
CREATE INDEX idx_fulfillment_followups_scheduled ON fulfillment_followups(scheduled_for);
CREATE INDEX idx_fulfillment_followups_status ON fulfillment_followups(status);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fulfillments_updated_at BEFORE UPDATE ON fulfillments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
