-- Migration: Customer Card Enhancements
-- Description: Add customer notes, tags, and enhanced tracking

-- Create customer notes table
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  customer_email text NOT NULL,
  note text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT customer_notes_pkey PRIMARY KEY (id),
  CONSTRAINT customer_notes_business_id_fkey FOREIGN KEY (business_id) 
    REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Create customer tags table
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  customer_email text NOT NULL,
  tag text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_tags_pkey PRIMARY KEY (id),
  CONSTRAINT customer_tags_business_id_fkey FOREIGN KEY (business_id) 
    REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT customer_tags_unique UNIQUE (business_id, customer_email, tag)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_notes_business_email 
  ON public.customer_notes(business_id, customer_email);

CREATE INDEX IF NOT EXISTS idx_customer_tags_business_email 
  ON public.customer_tags(business_id, customer_email);

CREATE INDEX IF NOT EXISTS idx_prospects_status 
  ON public.prospects(business_id, status);

CREATE INDEX IF NOT EXISTS idx_prospects_email 
  ON public.prospects(business_id, email);

-- Add updated_at column to prospects if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prospects' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.prospects ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

-- Add engagement_score column to prospects if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prospects' AND column_name = 'engagement_score'
  ) THEN
    ALTER TABLE public.prospects ADD COLUMN engagement_score integer DEFAULT 0;
  END IF;
END $$;

-- Add total_value column to prospects if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prospects' AND column_name = 'total_value'
  ) THEN
    ALTER TABLE public.prospects ADD COLUMN total_value numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE public.customer_notes IS 'Notes added by users about customers';
COMMENT ON TABLE public.customer_tags IS 'Tags for organizing and segmenting customers';
COMMENT ON COLUMN public.prospects.engagement_score IS 'Engagement score (0-100) based on activity';
COMMENT ON COLUMN public.prospects.total_value IS 'Total revenue from this customer';

