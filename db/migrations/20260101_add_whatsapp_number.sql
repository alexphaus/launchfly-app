-- Migration: Add missing columns for WhatsApp OS
-- Run this in your Supabase SQL Editor

-- 1. Add whatsapp_number to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 2. Add missing columns to customers table (for WhatsApp OS lead capture)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';

-- Optional: Copy existing phone_number to whatsapp_number if you want a default
-- UPDATE businesses SET whatsapp_number = phone_number WHERE whatsapp_number IS NULL;
