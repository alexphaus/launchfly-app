// Behavioral trigger detection
export const behaviorTriggers = {
  // Time-based triggers
  timeOnPage: {
    15: () => "Hey! Saw you checking out our solution 👋",
    30: () => "Still exploring? I'm here if you have questions!",
    60: () => "Taking your time researching - smart! What matters most to you?",
    120: () => "Still here? You must be serious about this!"
  },

  // Scroll-based triggers
  scrollTriggers: {
    50: () => "I see you're getting into the details. Any questions so far?",
    75: () => "Almost at the bottom! What do you think?",
    pricing: () => "Questions about pricing? I'm here to help! 💰",
    testimonials: () => "Those are real results! What would success look like for you?"
  },

  // Mouse behavior triggers
  mouseTriggers: {
    exitIntent: () => "Wait! Here's 20% off before you go 🎯",
    backButton: () => "Hold up! Can I answer a quick question first?",
    tabSwitch: () => "Still thinking it over? What's your main concern?"
  },

  // Engagement triggers
  engagementTriggers: {
    multipleVisits: () => "Welcome back! Still considering this?",
    returnVisitor: () => "Good to see you again! Ready to take the next step?",
    highIntent: () => "I can see you're serious about this. Let's make it happen!"
  }
};

// Intent scoring algorithm
export const intentScoring = {
  // Positive signals (increase intent)
  positiveSignals: {
    timeOnPage: {
      30: 10,
      60: 20,
      120: 30,
      300: 40
    },
    scrollDepth: {
      50: 15,
      75: 25,
      100: 35
    },
    pageViews: {
      2: 10,
      3: 20,
      5: 30
    },
    pricingViews: 25,
    testimonialViews: 15,
    featureClicks: 20,
    returningVisitor: 20
  },

  // Negative signals (decrease intent)
  negativeSignals: {
    fastScrolling: -10,
    quickExit: -15,
    multipleExitAttempts: -20,
    noEngagement: -5
  },

  // Calculate final intent score
  calculateScore: (signals) => {
    let score = 0;
    
    // Add positive signals
    Object.entries(signals.positive || {}).forEach(([signal, value]) => {
      if (intentScoring.positiveSignals[signal]) {
        if (typeof intentScoring.positiveSignals[signal] === 'object') {
          // Range-based scoring
          const ranges = Object.entries(intentScoring.positiveSignals[signal]);
          for (const [threshold, points] of ranges) {
            if (value >= parseInt(threshold)) {
              score = Math.max(score, points);
            }
          }
        } else {
          // Fixed scoring
          score += intentScoring.positiveSignals[signal];
        }
      }
    });

    // Subtract negative signals
    Object.entries(signals.negative || {}).forEach(([signal, value]) => {
      if (intentScoring.negativeSignals[signal]) {
        score += intentScoring.negativeSignals[signal] * (value || 1);
      }
    });

    return Math.max(0, Math.min(100, score));
  }
};

// Conversion psychology principles
export const psychologyTriggers = {
  // Scarcity
  scarcity: {
    time: "Only {minutes} minutes left at this price!",
    quantity: "Just {number} spots remaining!",
    social: "{number} people viewing this right now"
  },

  // Social proof
  socialProof: {
    recent: "Someone just bought this 2 minutes ago",
    volume: "{number} customers this week",
    testimonial: "'{quote}' - {name}, {title}"
  },

  // Authority
  authority: {
    expert: "Recommended by {expert_count} industry experts",
    media: "Featured in {media_outlet}",
    credentials: "Created by {credentials}"
  },

  // Reciprocity
  reciprocity: {
    freeValue: "Here's a free {resource} while you decide",
    bonus: "I'll throw in {bonus} at no extra cost",
    discount: "Let me give you {percentage}% off just for asking"
  },

  // Loss aversion
  lossAversion: {
    cost: "Every day you wait costs you ${daily_cost}",
    opportunity: "Missing out on {opportunity} while you decide",
    competition: "Your competitors are already using this"
  }
};

// Smart message selection based on visitor profile
export const messageSelector = {
  selectMessage: (visitorProfile, stage, context) => {
    const { intent, timeOnPage, device, trafficSource, returning } = visitorProfile;
    
    // High intent visitors - direct approach
    if (intent > 70) {
      return psychologyTriggers.directApproach[stage];
    }
    
    // Price-conscious visitors
    if (context.showedPricing && intent < 40) {
      return psychologyTriggers.valueEmphasis[stage];
    }
    
    // Mobile visitors - concise messages
    if (device === 'mobile') {
      return psychologyTriggers.mobileOptimized[stage];
    }
    
    // Returning visitors - acknowledgment
    if (returning) {
      return psychologyTriggers.returningVisitor[stage];
    }
    
    // Default flow
    return psychologyTriggers.default[stage];
  }
};
