-- Create sales table to track purchases
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text,
  product_name text NOT NULL,
  amount numeric NOT NULL,
  stripe_session_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS sales_business_id_idx ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON public.sales(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create policy for sales access (business owners can see their own sales)
CREATE POLICY "Business owners can view their sales" ON public.sales
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses 
      WHERE user_id = auth.uid()
    )
  );
