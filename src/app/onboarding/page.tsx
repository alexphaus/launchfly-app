'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OnboardingRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const template = searchParams.get('template');
    const plan = searchParams.get('plan');
    const idea = searchParams.get('idea');
    
    // Route based on parameters
    if (template) {
      // Template selection flow
      router.replace(`/onboarding/quick-start?template=${encodeURIComponent(template)}&plan=${plan || 'starter'}`);
    } else if (idea) {
      // Custom business flow
      router.replace(`/onboarding/custom?idea=${encodeURIComponent(idea)}`);
    } else if (plan) {
      // Plan selection flow
      router.replace(`/onboarding/quick-start?plan=${plan}`);
    } else {
      // Default to quick start
      router.replace('/onboarding/quick-start');
    }
  }, [router, searchParams]);

  return (
    <div className="onboarding-header">
      <div className="onboarding-logo">
        <span className="onboarding-logo-icon">⚡</span>
        <span className="onboarding-logo-text">Launchfly</span>
      </div>
      <div className="loading-spinner"></div>
    </div>
  );
}
