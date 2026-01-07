-- Bookings table for slot management
-- Each booking represents a blocked time slot for a business

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Slot information
    slot_date DATE NOT NULL,
    slot_time TEXT NOT NULL, -- e.g., '9am-11am', '1pm-3pm', '3pm-5pm'
    slot_label TEXT, -- Human readable: "Today 9am - 11am"
    
    -- Booking details
    status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, cancelled, blocked
    booking_type TEXT NOT NULL DEFAULT 'customer', -- customer, admin_block
    
    -- Customer info (for customer bookings)
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    estimate TEXT,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast slot lookups
CREATE INDEX IF NOT EXISTS idx_bookings_business_date ON bookings(business_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Business settings for default slots (add to businesses table)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS slot_settings JSONB DEFAULT '{
    "slots": [
        {"id": "morning", "label": "9am - 11am", "start": "09:00", "end": "11:00"},
        {"id": "early_afternoon", "label": "1pm - 3pm", "start": "13:00", "end": "15:00"},
        {"id": "late_afternoon", "label": "3pm - 5pm", "start": "15:00", "end": "17:00"}
    ],
    "days_ahead": 3,
    "buffer_hours": 2
}'::jsonb;

-- Example: Mark a full day as blocked
-- INSERT INTO bookings (business_id, slot_date, slot_time, status, booking_type, notes)
-- VALUES ('...', '2026-01-07', 'all_day', 'blocked', 'admin_block', 'Owner unavailable');
