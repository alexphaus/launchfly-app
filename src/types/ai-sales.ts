// AI Sales Agent Type Definitions

// Visitor Intent Tracking
export interface VisitorSignals {
  sessionId: string;
  timestamp: number;
  mouseVelocity: number;
  scrollDepth: number;
  timeOnPage: number;
  ctaHovers: number;
  pricingViews: number;
  exitIntentTriggered: boolean;
  inactivityDuration: number;
  previousVisits: number;
  referralSource: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  currentPage: string;
  cartAbandoned: boolean;
}

export interface IntentScore {
  score: number; // 0-100
  confidence: number; // 0-1
  primaryIntent: 'purchase' | 'research' | 'comparison' | 'support' | 'leaving';
  signals: VisitorSignals;
  recommendation: 'engage' | 'wait' | 'monitor';
}

// AI Agent Context
export interface AIAgentContext {
  businessId: string;
  sessionId: string;
  visitorProfile: VisitorProfile;
  conversationHistory: ChatMessage[];
  currentIntent: IntentScore;
  productCatalog: Product[];
  pricingRules: PricingRules;
  personalityConfig: PersonalityConfig;
  salesPatterns: SalesPattern[];
}

export interface VisitorProfile {
  id: string;
  isReturning: boolean;
  purchaseHistory: Purchase[];
  engagementHistory: Engagement[];
  preferences: Record<string, any>;
  segment: 'high-value' | 'regular' | 'new' | 'at-risk';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    functionCall?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    intent?: string;
    confidence?: number;
  };
}

// Pricing & Negotiation
export interface PricingRules {
  basePrice: number;
  currency: string;
  discountTiers: DiscountTier[];
  bundleOptions: BundleOption[];
  negotiationEnabled: boolean;
  maxDiscountPercent: number;
  minAcceptablePrice: number;
  dynamicPricing: boolean;
  expirationRules: ExpirationRule[];
}

export interface DiscountTier {
  threshold: number; // Intent score threshold
  discountPercent: number;
  requiresApproval: boolean;
  conditions: string[];
}

export interface BundleOption {
  id: string;
  name: string;
  products: string[];
  bundlePrice: number;
  savings: number;
}

export interface ExpirationRule {
  type: 'time-based' | 'quantity-based' | 'event-based';
  duration?: number; // minutes
  quantity?: number;
  eventTrigger?: string;
}

// Sales Patterns & Learning
export interface SalesPattern {
  id: string;
  patternType: 'successful' | 'failed' | 'abandoned';
  visitorSegment: string;
  conversationFlow: ConversationNode[];
  outcome: SalesOutcome;
  timestamp: number;
  confidence: number;
  applicableProducts: string[];
}

export interface ConversationNode {
  userIntent: string;
  aiResponse: string;
  functionCalled?: string;
  effectivenessScore: number;
  nextBestActions: string[];
}

export interface SalesOutcome {
  converted: boolean;
  revenue?: number;
  discountApplied?: number;
  timeToConversion?: number; // seconds
  objectionPoints: string[];
  successFactors: string[];
}

// Product Catalog
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  features: string[];
  category: string;
  inventory?: number;
  customizable: boolean;
  aiTalkingPoints: string[];
}

// AI Personality Configuration
export interface PersonalityConfig {
  tone: 'professional' | 'friendly' | 'casual' | 'enthusiastic';
  aggressiveness: number; // 1-10
  humorLevel: number; // 0-5
  formalityLevel: number; // 1-10
  responseLength: 'concise' | 'moderate' | 'detailed';
  emoji: boolean;
  customPrompts: {
    greeting?: string;
    objectionHandling?: Record<string, string>;
    closingStatements?: string[];
  };
}

// Payment & Checkout
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripePaymentIntentId?: string;
  metadata: {
    sessionId: string;
    conversationId: string;
    discountApplied?: number;
    source: 'ai-chat' | 'manual';
  };
}

export interface Purchase {
  id: string;
  timestamp: number;
  amount: number;
  products: Product[];
  paymentMethod: string;
  conversationId?: string;
  aiAssisted: boolean;
}

export interface Engagement {
  id: string;
  timestamp: number;
  type: 'chat' | 'email' | 'phone' | 'form';
  duration: number;
  outcome: 'converted' | 'interested' | 'not-interested' | 'abandoned';
}

// Analytics Events
export interface AnalyticsEvent {
  eventName: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  properties: Record<string, any>;
}

// Configuration Types
export interface AIAgentConfig {
  id: string;
  businessId: string;
  enabled: boolean;
  triggerThreshold: number;
  personalityConfig: PersonalityConfig;
  pricingRules: PricingRules;
  integrations: {
    stripe: StripeConfig;
    analytics: AnalyticsConfig;
  };
  abTestVariants?: ABTestVariant[];
}

export interface StripeConfig {
  accountId: string;
  publishableKey: string;
  webhookEndpointId: string;
  paymentMethods: string[];
  captureMethod: 'automatic' | 'manual';
}

export interface AnalyticsConfig {
  provider: 'posthog' | 'mixpanel' | 'custom';
  projectId: string;
  apiKey: string;
  customEvents: string[];
}

export interface ABTestVariant {
  id: string;
  name: string;
  allocation: number; // percentage
  modifications: {
    greeting?: string;
    triggerThreshold?: number;
    personality?: Partial<PersonalityConfig>;
  };
}