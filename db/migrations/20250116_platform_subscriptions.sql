-- Create platform_subscriptions table to track Professional and Scale plan payments
CREATE TABLE IF NOT EXISTS platform_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('professional', 'scale')),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_platform_subscriptions_email ON platform_subscriptions(user_email);
CREATE INDEX idx_platform_subscriptions_plan ON platform_subscriptions(plan);
CREATE INDEX idx_platform_subscriptions_created_at ON platform_subscriptions(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_platform_subscriptions_updated_at 
  BEFORE UPDATE ON platform_subscriptions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add column to businesses table to track if business was created with paid plan
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS paid_plan_session_id VARCHAR(255),
ADD CONSTRAINT fk_paid_plan_session 
  FOREIGN KEY (paid_plan_session_id) 
  REFERENCES platform_subscriptions(stripe_session_id);

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_businesses_paid_plan_session ON businesses(paid_plan_session_id);
