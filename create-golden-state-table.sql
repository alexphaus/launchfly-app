-- Golden state images: reference photos of "fully stocked" inventory
-- Used by the visual inventory comparison feature
CREATE TABLE IF NOT EXISTS golden_state_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  label TEXT,              -- e.g. "Market stall - jewelry section", "Van left shelf"
  category TEXT,           -- e.g. "stall", "van", "shelf", "expositor"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_golden_state_business ON golden_state_images(business_id);
