-- Add booking_url column to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN businesses.booking_url IS 'URL for booking/scheduling (e.g., Calendly, website) - used in QR codes on PDF';
