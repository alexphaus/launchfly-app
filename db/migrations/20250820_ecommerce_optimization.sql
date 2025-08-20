-- E-commerce Revenue Optimization Migration
-- Date: 2025-08-20
-- Priority: Critical for reaching $1000/business goal

-- Proper Products Table (instead of JSON storage)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2), -- For showing discounts
  inventory_count INTEGER DEFAULT 999,
  sales_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Management System
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','fulfilled','refunded','abandoned')),
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripe_session_id TEXT UNIQUE,
  
  -- Abandoned Cart Recovery
  cart_token TEXT UNIQUE, -- For tracking abandoned carts
  abandoned_at TIMESTAMP WITH TIME ZONE,
  recovery_email_sent_at TIMESTAMP WITH TIME ZONE,
  recovered_at TIMESTAMP WITH TIME ZONE,
  
  -- Customer Address
  shipping_address JSONB,
  billing_address JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items (for multi-item orders)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL, -- Store name in case product is deleted
  product_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Accounts
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  total_spent DECIMAL(10,2) DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  first_order_date TIMESTAMP WITH TIME ZONE,
  last_order_date TIMESTAMP WITH TIME ZONE,
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  
  -- Marketing
  accepts_marketing BOOLEAN DEFAULT true,
  marketing_source TEXT, -- 'organic', 'referral', 'facebook', etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, email)
);

-- Discount Codes
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
  value DECIMAL(10,2) NOT NULL,
  minimum_order_amount DECIMAL(10,2) DEFAULT 0,
  usage_limit INTEGER, -- NULL = unlimited
  usage_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, code)
);

-- Cart Sessions (for abandoned cart tracking)
CREATE TABLE IF NOT EXISTS cart_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Abandonment tracking
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  abandoned_at TIMESTAMP WITH TIME ZONE,
  recovery_emails_sent INTEGER DEFAULT 0,
  recovered BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews & Social Proof
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  verified_purchase BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketing Analytics
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id TEXT,
  event_type TEXT NOT NULL, -- 'page_view', 'add_to_cart', 'checkout_start', 'purchase'
  product_id UUID REFERENCES products(id),
  customer_email TEXT,
  value DECIMAL(10,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_business_status ON products(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_business_status ON orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_abandoned ON orders(business_id, abandoned_at) WHERE abandoned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_sessions_abandoned ON cart_sessions(business_id, abandoned_at) WHERE abandoned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_business_email ON customers(business_id, email);
CREATE INDEX IF NOT EXISTS idx_discount_codes_business_code ON discount_codes(business_id, code);

-- Update existing sales table to reference orders
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);
