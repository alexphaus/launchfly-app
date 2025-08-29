// Analytics tracking for onboarding and conversion events

export type OnboardingEvent = {
  event: 'onboarding_started' | 'onboarding_step_completed' | 'onboarding_completed' | 'onboarding_abandoned';
  properties?: {
    step?: number;
    template?: string;
    plan?: string;
    idea?: string;
    duration?: number;
    error?: string;
  };
};

export type ConversionEvent = {
  event: 'cta_clicked' | 'template_selected' | 'account_created' | 'business_created';
  properties?: {
    cta_location?: string;
    template_id?: string;
    plan?: string;
    value?: number;
  };
};

class Analytics {
  private sessionId: string;
  private startTime: number;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendEvent(eventData: any) {
    try {
      // Send to your analytics endpoint
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...eventData,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }

  trackOnboarding(event: OnboardingEvent) {
    const duration = Date.now() - this.startTime;
    this.sendEvent({
      type: 'onboarding',
      ...event,
      properties: {
        ...event.properties,
        duration,
      },
    });
  }

  trackConversion(event: ConversionEvent) {
    this.sendEvent({
      type: 'conversion',
      ...event,
    });
  }

  // Track page views
  trackPageView(page: string, properties?: any) {
    this.sendEvent({
      type: 'page_view',
      page,
      properties,
    });
  }

  // Track time spent on page
  trackTimeSpent(page: string, seconds: number) {
    this.sendEvent({
      type: 'time_spent',
      page,
      seconds,
    });
  }

  // Get session duration
  getSessionDuration(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

// Export singleton instance
export const analytics = new Analytics();
