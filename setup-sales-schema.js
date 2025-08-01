#!/usr/bin/env node

/**
 * Sales table migration script
 * Run with: node setup-sales-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function setupSalesSchema() {
  console.log('🚀 Setting up sales schema for Launchfly...');

  // 1. Check if the sales table exists
  const { data: salesTable, error: checkError } = await supabase
    .from('sales')
    .select('id')
    .limit(1)
    .catch(() => ({ data: null }));

  if (!checkError && salesTable !== null) {
    console.log('✓ Sales table already exists');
  } else {
    console.log('Creating sales table...');
    
    // Execute SQL to create the sales table
    // Note: In a real migration, you'd use the Supabase migrations system
    // This is just a demonstration of what needs to happen
    const { error: createError } = await supabase.rpc('create_sales_table');

    if (createError) {
      console.error('Error creating sales table:', createError);
      console.log('You may need to run this SQL in the Supabase SQL editor:');
      console.log(`
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  stripe_session_id TEXT UNIQUE,
  payment_status TEXT DEFAULT 'paid',
  customer_address JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX sales_business_id_idx ON public.sales(business_id);
CREATE INDEX sales_stripe_session_id_idx ON public.sales(stripe_session_id);

-- Add new columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS total_revenue DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_sale_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sale_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;
      `);
    } else {
      console.log('✓ Sales table created successfully');
    }
  }

  // 2. Check and update the businesses table with required columns
  console.log('Checking business table schema...');
  
  // Check if total_revenue column exists
  const { data: businessColumn, error: columnError } = await supabase
    .rpc('column_exists', { table_name: 'businesses', column_name: 'total_revenue' })
    .single();

  if (columnError) {
    console.error('Error checking business table schema:', columnError);
    console.log('You may need to add the columns manually in the Supabase SQL editor');
  } else if (businessColumn && businessColumn.exists) {
    console.log('✓ Business table already has required columns');
  } else {
    console.log('Adding columns to businesses table...');
    
    const { error: alterError } = await supabase.rpc('add_business_sales_columns');

    if (alterError) {
      console.error('Error updating business table:', alterError);
    } else {
      console.log('✓ Business table updated successfully');
    }
  }

  console.log('\n🎉 Sales schema setup complete!');
}

setupSalesSchema().catch(console.error);
