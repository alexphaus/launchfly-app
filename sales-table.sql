-- Create sales table to track purchases
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  stripe_session_id text NOT NULL UNIQUE,
  product_name text NOT NULL,
  amount numeric NOT NULL,
  quantity integer DEFAULT 1,
  customer_email text,
  customer_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Add policy to allow business owners to see their own sales
CREATE POLICY "Users can view their own business sales" ON public.sales
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses 
      WHERE user_id = auth.uid()
    )
  );

-- Add policy to allow the webhook to insert sales (service role)
CREATE POLICY "Service role can insert sales" ON public.sales
  FOR INSERT WITH CHECK (true);
