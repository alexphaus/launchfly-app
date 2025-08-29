'use client';

import { useEffect } from 'react';
import './onboarding.css';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Prevent scroll on body when in onboarding
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-logo">
          <span className="logo-icon">⚡</span>
          <span>Launch<span style={{ color: 'var(--secondary)' }}>fly</span></span>
        </div>
      </div>
      <div className="onboarding-content">
        {children}
      </div>
    </div>
  );
}
