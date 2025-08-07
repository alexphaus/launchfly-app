// Tested high-converting patterns and templates

export const conversionTemplates = {
  // Opening messages by visitor type
  openers: {
    first_time: [
      "I help {audience} get {benefit} in {timeframe}. What's your biggest challenge?",
      "Most people come here struggling with {problem}. Is that you too?",
      "Quick question - what's stopping you from {desired_outcome}?",
      "I see you're interested in {product}. What brought you here today?"
    ],
    returning: [
      "Welcome back! Still thinking about {product}?",
      "Good to see you again! Any questions since your last visit?",
      "I remember you! Ready to take the next step with {product}?"
    ],
    high_intent: [
      "I can see you're serious about {benefit}. Let's make this happen!",
      "You've been exploring for a while - ready to solve {problem} today?",
      "Based on what you're looking at, this could be perfect for you!"
    ]
  },

  // Qualifying questions to understand needs
  qualifying: {
    discovery: [
      "What's your current situation with {problem_area}?",
      "How long have you been dealing with {pain_point}?",
      "What have you tried before to solve this?",
      "What would success look like for you?",
      "What's your timeline for getting this resolved?"
    ],
    budget: [
      "What's your budget range for solving this?",
      "How much is {problem} costing you monthly?",
      "What's the value of fixing this worth to you?",
      "Are you looking to invest in a complete solution?"
    ],
    urgency: [
      "How urgent is solving this for you?",
      "What happens if you don't address this soon?",
      "When do you need this implemented by?",
      "Is this a priority project for you?"
    ]
  },

  // Objection handling (psychology-based)
  objections: {
    price: [
      "I get it - {price} feels like a lot. But what's {problem} costing you every month you wait?",
      "Fair point. Most clients make this back in the first {timeframe}. Worth considering?",
      "I understand budget concerns. What if we could break this into 3 payments?",
      "The real question is: can you afford NOT to fix {problem}?"
    ],
    trust: [
      "I totally get that concern. That's exactly why we offer a 30-day guarantee.",
      "Smart to be cautious! Here's what other customers said after trying it...",
      "Fair question. We've helped {number} people with this exact problem.",
      "I'd be skeptical too. Want to see what results others have gotten?"
    ],
    timing: [
      "I hear you on timing. But here's the thing - every day costs you {daily_cost}.",
      "Timing's never perfect. But this problem isn't getting better on its own.",
      "I get being busy. This actually saves you {time_saved} per week once set up.",
      "What if I told you this takes just {setup_time} to implement?"
    ],
    features: [
      "Great question! The key is that it handles {main_benefit} automatically.",
      "You don't need all features day one. Start with {core_feature}.",
      "Most people only use 3-4 features, but they're game-changers.",
      "It includes everything you need for {main_goal}. Nothing extra to buy."
    ],
    competition: [
      "Good research! The difference is {unique_advantage}.",
      "I've seen people try those. Here's what they miss...",
      "Fair comparison. The key advantage we have is {differentiator}.",
      "Yes, there are options. This one works because {reason}."
    ]
  },

  // Closing statements (urgency + value)
  closes: [
    "Based on what you told me, this solves {their_problem}. Ready to get started?",
    "You said {their_words}. This does exactly that. Should we set you up?",
    "Perfect fit! I can lock in {discount}% off, but only for the next 10 minutes.",
    "This eliminates {pain_point} starting today. Want me to get you access?",
    "I can save you {time/money_benefit}. Shall we make it happen?",
    "You're exactly who this was built for. Ready to solve {problem} once and for all?"
  ],

  // Social proof integration
  social_proof: [
    "{name} had the same concern. Now they're saving {benefit} monthly.",
    "Just yesterday, a customer told me this solved {problem} in {timeframe}.",
    "{number} people bought this while you've been browsing.",
    "Other {audience} love this because {specific_benefit}.",
    "95% of our customers see results within {timeframe}."
  ],

  // Urgency creators (ethical)
  urgency: [
    "Price goes up {amount} at midnight tonight.",
    "Only {number} spots left at this price level.",
    "This bonus expires in {timeframe}.",
    "I can only hold this discount for {timeframe}.",
    "Implementation spots for {month} are almost full."
  ],

  // Risk reversal
  guarantees: [
    "30-day money-back guarantee. If it doesn't work, full refund.",
    "Try it risk-free. If you're not happy, just let me know.",
    "We're so confident, we guarantee {specific_result} or your money back.",
    "Zero risk on your end. If it doesn't deliver, I'll refund every penny."
  ]
};

// Psychology-based conversation flows
export const conversationFlows = {
  // High-intent visitors (fast track to close)
  high_intent: {
    greeting: "I can see you're serious about {product}. What's the main problem you need solved?",
    qualifying: "Perfect! This handles {problem} automatically. What questions can I answer?",
    closing: "Based on what you said, this is exactly what you need. Ready to get started?"
  },

  // Price-conscious visitors
  budget_conscious: {
    greeting: "Looking for an affordable way to {solve_problem}?",
    qualifying: "Smart to consider ROI. This typically pays for itself in {timeframe}.",
    closing: "Plus I can offer {discount}% off today. Makes sense to try it?"
  },

  // Comparison shoppers
  comparison: {
    greeting: "Comparing options? Smart. What features matter most to you?",
    qualifying: "The key difference is {unique_advantage}. That important to you?",
    closing: "Based on your needs, this is clearly the best fit. Let's get you set up."
  }
};

// Personalization based on visitor data
export const personalizationRules = {
  // Industry-specific messaging
  industry: {
    ecommerce: {
      problems: ["low conversion rates", "cart abandonment", "customer acquisition"],
      benefits: ["increase sales", "boost revenue", "grow customers"],
      metrics: ["conversion rate", "AOV", "customer lifetime value"]
    },
    saas: {
      problems: ["churn", "user onboarding", "feature adoption"],
      benefits: ["reduce churn", "improve retention", "increase engagement"],
      metrics: ["MRR", "churn rate", "user engagement"]
    },
    coaching: {
      problems: ["finding clients", "pricing", "scaling"],
      benefits: ["attract clients", "charge premium", "scale income"],
      metrics: ["client acquisition", "hourly rate", "monthly revenue"]
    }
  },

  // Traffic source messaging
  traffic_source: {
    google: "Found us on Google? You must be actively looking for {solution}.",
    facebook: "Came from Facebook? Perfect timing - this solves {problem}.",
    direct: "Welcome back! Ready to take action on {product}?",
    referral: "Great referral! They probably told you about {benefit}."
  },

  // Device-specific
  device: {
    mobile: "Quick question while you're on mobile - what's your biggest {problem}?",
    desktop: "I see you're researching thoroughly - what questions can I answer?",
    tablet: "Perfect device for exploring this - what interests you most?"
  }
};

// Conversion event triggers
export const triggers = {
  time_based: {
    15: "Hey! Saw you checking out {product} 👋",
    30: "Still exploring? I'm here if you have questions!",
    60: "Taking your time researching - smart! What matters most to you?",
    120: "Still here? You must be serious about {benefit}!"
  },

  behavior_based: {
    exit_intent: "Wait! Here's 20% off before you go 🎯",
    pricing_scroll: "Questions about pricing? I'm here to help! 💰",
    multiple_visits: "Welcome back! Still thinking it over?",
    feature_clicks: "I see you're interested in {feature}. Want me to explain how it works?"
  },

  engagement_based: {
    high_scroll: "You're really diving deep! What specific question can I answer?",
    quick_browse: "Moving fast? Let me quickly show you the key benefits.",
    testimonial_view: "Those are real results! What would success look like for you?"
  }
};
