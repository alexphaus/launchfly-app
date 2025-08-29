// Onboarding Analytics Utility
// Tracks user progress through the onboarding flow for optimization

interface OnboardingEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

class OnboardingAnalytics {
  private sessionId: string;
  private events: OnboardingEvent[] = [];

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `onboarding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Track when user enters onboarding flow
  trackOnboardingStart(source: string, template?: string, plan?: string) {
    this.track('onboarding_started', {
      source,
      template,
      plan,
      timestamp: Date.now()
    });
  }

  // Track step progression
  trackStepCompleted(step: number, stepName: string, data?: Record<string, any>) {
    this.track('onboarding_step_completed', {
      step,
      stepName,
      ...data,
      timestamp: Date.now()
    });
  }

  // Track step abandonment
  trackStepAbandoned(step: number, stepName: string, timeSpent: number) {
    this.track('onboarding_step_abandoned', {
      step,
      stepName,
      timeSpent,
      timestamp: Date.now()
    });
  }

  // Track form field interactions
  trackFieldInteraction(fieldName: string, action: 'focus' | 'blur' | 'change') {
    this.track('onboarding_field_interaction', {
      fieldName,
      action,
      timestamp: Date.now()
    });
  }

  // Track validation errors
  trackValidationError(step: number, field: string, error: string) {
    this.track('onboarding_validation_error', {
      step,
      field,
      error,
      timestamp: Date.now()
    });
  }

  // Track successful completion
  trackOnboardingCompleted(data: Record<string, any>) {
    this.track('onboarding_completed', {
      ...data,
      totalEvents: this.events.length,
      completionTime: Date.now(),
      timestamp: Date.now()
    });

    // Send all events to analytics endpoint
    this.flush();
  }

  // Track CTA clicks from landing page
  trackCTAClick(ctaType: string, location: string, template?: string, plan?: string) {
    this.track('cta_clicked', {
      ctaType,
      location,
      template,
      plan,
      timestamp: Date.now()
    });
  }

  // Private method to add event to queue
  private track(event: string, properties?: Record<string, any>) {
    this.events.push({
      event,
      properties: {
        sessionId: this.sessionId,
        ...properties
      },
      timestamp: Date.now()
    });

    // Auto-flush if too many events
    if (this.events.length > 50) {
      this.flush();
    }
  }

  // Send events to analytics endpoint
  private async flush() {
    if (this.events.length === 0) return;

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events: this.events
        })
      });

      // Clear events after successful send
      this.events = [];
    } catch (error) {
      console.warn('Failed to send analytics events:', error);
      // Keep events for retry
    }
  }

  // Get session ID for external use
  getSessionId(): string {
    return this.sessionId;
  }

  // Manual flush for important events
  async flushNow(): Promise<void> {
    await this.flush();
  }
}

// Singleton instance for easy usage
let analyticsInstance: OnboardingAnalytics | null = null;

export function getOnboardingAnalytics(sessionId?: string): OnboardingAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new OnboardingAnalytics(sessionId);
  }
  return analyticsInstance;
}

// Convenience functions
export function trackCTAClick(ctaType: string, location: string, template?: string, plan?: string) {
  getOnboardingAnalytics().trackCTAClick(ctaType, location, template, plan);
}

export function trackOnboardingStart(source: string, template?: string, plan?: string) {
  getOnboardingAnalytics().trackOnboardingStart(source, template, plan);
}

export function trackStepCompleted(step: number, stepName: string, data?: Record<string, any>) {
  getOnboardingAnalytics().trackStepCompleted(step, stepName, data);
}

export function trackValidationError(step: number, field: string, error: string) {
  getOnboardingAnalytics().trackValidationError(step, field, error);
}

export function trackOnboardingCompleted(data: Record<string, any>) {
  getOnboardingAnalytics().trackOnboardingCompleted(data);
}
