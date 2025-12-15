// src/components/VisitorTracker.js
'use client';

import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function VisitorTracker({ businessId, subdomain }) {
  useEffect(() => {
    // Only track once per session
    const sessionKey = `visitor_tracked_${subdomain || businessId}`;
    
    if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
      trackVisitor();
      sessionStorage.setItem(sessionKey, 'true');
    }
  }, [businessId, subdomain]);

  const trackVisitor = async () => {
    try {
      // 1. Check for admin/preview flags in URL
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('preview') === 'true' || searchParams.get('admin') === 'true' || searchParams.get('role') === 'founder') {
        console.log('🚫 Analytics skipped: Preview/Admin mode detected in URL');
        return;
      }

      // 2. Check if user is logged in (Founder)
      try {
        const supabase = createClientComponentClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('🚫 Analytics skipped: User is logged in (Founder)');
          return;
        }
      } catch (e) {
        // Ignore auth check errors if supabase isn't configured on this route
      }

      // Generate or get visitor ID
      const visitorId = getOrCreateVisitorId();
      
      const response = await fetch('/api/analytics/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          subdomain,
          pageUrl: window.location.pathname,
          visitorId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Visitor tracked:', data);
      }
    } catch (error) {
      // Silently fail - don't impact user experience
      console.log('Visitor tracking failed:', error.message);
    }
  };

  const getOrCreateVisitorId = () => {
    const cookieName = 'launchfly_visitor_id';
    
    // Try to get existing cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName) {
        return value;
      }
    }
    
    // Create new visitor ID
    const visitorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Set cookie for 1 year
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${cookieName}=${visitorId};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    
    return visitorId;
  };

  // This component doesn't render anything
  return null;
}
