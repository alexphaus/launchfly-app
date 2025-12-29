-- Option 1: Find your own User ID (run this query in Supabase SQL Editor)
-- Copy the ID from the result and add it to .env.local as SYSTEM_USER_ID
SELECT id, email FROM auth.users LIMIT 5;

-- OR if you don't have any users, create a system user:
-- Option 2: Create a "system" profile for owning prospect businesses
-- First, you'll need to sign up a user through the Supabase Auth UI or use an existing user.

-- Example: If you sign up with alex@launchfly.ai, find that user's ID:
-- SELECT id FROM auth.users WHERE email = 'alex@launchfly.ai';

-- Then add to your .env.local:
-- SYSTEM_USER_ID=<the-uuid-from-above-query>
