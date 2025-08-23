# Authentication Setup Guide

This guide explains how to implement Google and Apple OAuth authentication for the UserProfile component.

## Overview

The UserProfile component is now integrated into the dashboard header with:
- ✅ Circular user avatar with subscription tier indicator
- ✅ Dropdown menu with authentication options
- ✅ Google, Apple, and Email sign-in buttons
- ✅ User settings and subscription management
- ✅ Sign out functionality

## Required Dependencies

Install the necessary authentication packages:

```bash
npm install @supabase/auth-helpers-nextjs @supabase/supabase-js
# OR for other auth providers:
npm install next-auth @next-auth/supabase-adapter
```

## Google OAuth Setup

### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API and Google OAuth2 API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

### 2. Environment Variables
Add to your `.env.local`:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Implementation Example
```javascript
// In UserProfile.js - replace the handleGoogleSignIn function
const handleGoogleSignIn = async () => {
  setIsLoading(true);
  try {
    // Using Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Google sign-in error:', error);
    setIsLoading(false);
  }
};
```

## Apple OAuth Setup

### 1. Apple Developer Setup
1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Create a new App ID with "Sign In with Apple" capability
3. Create a Services ID for web authentication
4. Configure domains and redirect URLs:
   - `https://yourdomain.com/api/auth/callback/apple`

### 2. Environment Variables
Add to your `.env.local`:
```env
APPLE_CLIENT_ID=your_apple_services_id
APPLE_CLIENT_SECRET=your_generated_client_secret
APPLE_KEY_ID=your_key_id
APPLE_TEAM_ID=your_team_id
```

### 3. Implementation Example
```javascript
// In UserProfile.js - replace the handleAppleSignIn function
const handleAppleSignIn = async () => {
  setIsLoading(true);
  try {
    // Using Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Apple sign-in error:', error);
    setIsLoading(false);
  }
};
```

## Email Authentication Setup

### Implementation Example
```javascript
// In UserProfile.js - replace the handleEmailSignIn function
const handleEmailSignIn = () => {
  // Option 1: Redirect to login page
  window.location.href = '/auth/login';
  
  // Option 2: Open modal (implement EmailAuthModal component)
  setShowEmailModal(true);
};
```

## User State Management

### Using Supabase Auth
```javascript
// In UserProfile.js - replace the useEffect for user state
useEffect(() => {
  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setUser({
        name: user.user_metadata?.full_name || user.email,
        email: user.email,
        avatar: user.user_metadata?.avatar_url,
        subscription: 'Pro', // Get from your database
        isAuthenticated: true,
        provider: user.app_metadata?.provider
      });
    }
  };

  getUser();

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Update user state
        getUser();
      } else if (event === 'SIGNED_OUT') {
        setUser({ isAuthenticated: false });
      }
    }
  );

  return () => subscription?.unsubscribe();
}, []);
```

## Database Schema

Add user profiles table to store additional user data:

```sql
-- Add to your Supabase database or schema.sql
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Next Steps

1. **Choose your auth provider** (Supabase, NextAuth.js, etc.)
2. **Set up OAuth applications** with Google and Apple
3. **Configure environment variables**
4. **Implement the auth functions** in UserProfile.js
5. **Create auth pages** (/auth/login, /auth/signup)
6. **Set up user database** for storing profiles and subscriptions
7. **Add protected routes** middleware

## Features Included

### ✅ Current Features
- Circular user avatar with initials
- Subscription tier color coding
- Dropdown menu with smooth animations
- Google/Apple/Email sign-in options
- Settings and subscription links
- Sign out functionality
- Loading states
- Click outside to close

### 🚀 Potential Enhancements
- User profile editing modal
- Subscription management integration
- Notification preferences
- Account deletion
- Two-factor authentication
- Social profile linking
- Avatar upload functionality

The UserProfile component is now ready for integration with your chosen authentication provider!
