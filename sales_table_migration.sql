-- Create sales table to track purchases
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  product_name text NOT NULL,
  amount numeric NOT NULL,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Add RLS policies for sales table
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read sales for their businesses
CREATE POLICY "Users can view sales for their businesses" ON public.sales
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Allow service role to insert sales (for webhooks)
CREATE POLICY "Service role can insert sales" ON public.sales
  FOR INSERT WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_sales_business_id ON public.sales(business_id);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);
CREATE INDEX idx_sales_stripe_session ON public.sales(stripe_session_id);
