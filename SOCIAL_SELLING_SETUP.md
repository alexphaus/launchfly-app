# 🚀 Social Selling System Setup Guide

## 📋 Prerequisites & Required Setup

To make the social selling system work, you need to set up several services and API integrations. Here's everything you need:

## 🔑 1. Environment Variables (.env.local)

Create a `.env.local` file in your project root with these variables:

```bash
# === CORE SERVICES (REQUIRED) ===
# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# OpenAI (for AI-generated content)
OPENAI_API_KEY=your_openai_api_key

# Resend (for email notifications)
RESEND_API_KEY=your_resend_api_key
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Your Company Name

# === SOCIAL PLATFORM APIS (REQUIRED FOR REAL CAMPAIGNS) ===
# Reddit API
REDDIT_CLIENT_ID=your_reddit_app_client_id
REDDIT_CLIENT_SECRET=your_reddit_app_client_secret
REDDIT_USERNAME=your_reddit_bot_username
REDDIT_PASSWORD=your_reddit_bot_password
REDDIT_USER_AGENT=YourApp/1.0 by YourUsername

# Facebook Graph API
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_ACCESS_TOKEN=your_long_lived_access_token

# LinkedIn API
LINKEDIN_CLIENT_ID=your_linkedin_app_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_app_client_secret
LINKEDIN_ACCESS_TOKEN=your_linkedin_access_token

# Twitter API v2
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret

# Instagram Basic Display API
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token

# === OPTIONAL (ENHANCED FEATURES) ===
# Inngest (for background job processing)
INNGEST_EVENT_KEY=your_inngest_event_key

# Base URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_WEBSITE_BASE_URL=https://yourdomain.com
UNSUBSCRIBE_URL=https://yourdomain.com/unsubscribe
```

## 🗄️ 2. Database Setup (Supabase)

### Required Tables
Your Supabase database needs these tables (some may already exist):

```sql
-- Business Activity (for social selling tracking)
CREATE TABLE IF NOT EXISTS business_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  message TEXT NOT NULL,
  details TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prospects (for social selling leads)
CREATE TABLE IF NOT EXISTS prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  name TEXT,
  email TEXT,
  platform TEXT NOT NULL,
  platform_username TEXT,
  engagement_score INTEGER DEFAULT 0,
  conversion_status TEXT DEFAULT 'new',
  last_contact TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Campaigns (track active campaigns)
CREATE TABLE IF NOT EXISTS social_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  platforms TEXT[] NOT NULL,
  status TEXT DEFAULT 'active',
  estimated_reach INTEGER,
  estimated_conversions INTEGER,
  estimated_first_sale TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔌 3. Platform API Setup

### 🔴 Reddit API
1. Go to https://www.reddit.com/prefs/apps
2. Create a new app (script type)
3. Note down client ID and secret
4. Create a dedicated Reddit account for the bot

### 📘 Facebook Graph API
1. Create Facebook Developer account: https://developers.facebook.com
2. Create a new app
3. Add Facebook Login product
4. Generate long-lived access token
5. Request permissions: `pages_read_engagement`, `pages_manage_posts`, `pages_messaging`

### 💼 LinkedIn API
1. Create LinkedIn Developer account: https://developer.linkedin.com
2. Create a new app
3. Request access to LinkedIn Marketing Developer Platform
4. Generate access tokens with required scopes

### 🐦 Twitter API v2
1. Apply for Twitter Developer account: https://developer.twitter.com
2. Create a new project and app
3. Generate API keys and access tokens
4. Ensure you have Basic or Pro tier for DM access

### 📸 Instagram Basic Display API
1. Use same Facebook Developer app
2. Add Instagram Basic Display product
3. Configure Instagram app for your business account
4. Generate access tokens

## 📦 4. Required NPM Packages

Install additional packages for platform integrations:

```bash
npm install snoowrap          # Reddit API wrapper
npm install fb                # Facebook Graph API
npm install linkedin-api      # LinkedIn API wrapper  
npm install twitter-api-v2    # Twitter API v2
npm install instagram-basic-display-api  # Instagram API
```

## 🚀 5. Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Run database migrations (if using Supabase locally)
npx supabase db reset

# 4. Start development server
npm run dev

# 5. Test the social selling system
curl -X POST http://localhost:3000/api/social-selling \
  -H "Content-Type: application/json" \
  -d '{"businessId": "test-id", "platforms": ["reddit", "facebook"]}'
```

## ⚠️ 6. Important Considerations

### Rate Limits & Best Practices
- **Reddit**: 60 requests per minute
- **Facebook**: 200 requests per hour per user
- **LinkedIn**: 100 requests per day for basic tier
- **Twitter**: 300 requests per 15 minutes
- **Instagram**: 200 requests per hour

### Compliance & Safety
- **Always follow platform Terms of Service**
- **Start with manual testing before automation**
- **Use realistic delays between actions (5-30 seconds)**
- **Limit daily actions to avoid detection**
- **Monitor for account restrictions/bans**

### Testing Strategy
1. **Simulation Mode**: System works without real API calls initially
2. **Single Platform**: Test one platform at a time
3. **Manual Review**: Review all generated content before posting
4. **Gradual Scaling**: Start with 5-10 actions per day, then scale up

## 🎯 7. Launch Checklist

- [ ] All environment variables configured
- [ ] Database tables created
- [ ] Platform API access verified
- [ ] Reddit bot account created and tested
- [ ] Facebook app approved for required permissions
- [ ] LinkedIn API access approved
- [ ] Twitter API tier sufficient for DMs
- [ ] Instagram business account connected
- [ ] Test campaign launched in simulation mode
- [ ] Manual content review process established
- [ ] Compliance guidelines documented
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up

## 🆘 8. Troubleshooting

### Common Issues:

**"API key not found" errors:**
- Check `.env.local` file exists and has correct variable names
- Restart Next.js server after adding environment variables

**"Database connection failed":**
- Verify Supabase URL and service key
- Check if tables exist in your database

**"Rate limit exceeded":**
- Platform APIs have strict limits - reduce request frequency
- Implement exponential backoff in API calls

**"Platform authentication failed":**
- Check if access tokens are expired
- Re-authenticate with platforms as needed

### Getting Help:
- Check browser console for detailed error messages
- Review Supabase logs for database issues
- Test API endpoints individually with curl/Postman
- Start with simulation mode to verify business logic

---

**Next Step**: Once you have these set up, you can launch your first social selling campaign from the dashboard! 🚀
