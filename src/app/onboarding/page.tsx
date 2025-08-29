'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Smart routing based on parameters
    const template = searchParams.get('template');
    const plan = searchParams.get('plan');
    const idea = searchParams.get('idea');
    
    if (template) {
      // User clicked on a specific business template
      router.push(`/onboarding/quick-start?template=${template}&plan=${plan || 'starter'}`);
    } else if (idea) {
      // User wants to create a custom business
      router.push(`/onboarding/custom?idea=${encodeURIComponent(idea)}`);
    } else {
      // Default to quick start with template selection
      router.push('/onboarding/quick-start');
    }
  }, [router, searchParams]);
  
  // Show loading state while routing
  return (
    <div className="onboarding-step">
      <div className="loading-spinner"></div>
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
        Preparing your journey...
      </p>
    </div>
  );
}
