# AI Revenue Autopilot - Architecture & Planning

## Overview
The AI Revenue Autopilot is an integrated AI sales agent that detects visitor intent, engages them via chat, negotiates offers, and processes payments directly on landing pages.

## Folder Structure

```
launchfly-app/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── ai-sales/
│   │       │   ├── chat/
│   │       │   │   └── route.js          # Main AI chat endpoint with streaming
│   │       │   ├── intent/
│   │       │   │   └── route.js          # Intent detection webhook
│   │       │   └── config/
│   │       │       └── route.js          # Agent configuration CRUD
│   │       └── stripe/
│   │           ├── ai-checkout/
│   │           │   └── route.js          # AI-initiated checkout sessions
│   │           └── ai-webhook/
│   │               └── route.js          # Payment webhook for AI sales
│   │
│   ├── components/
│   │   └── ai-sales/
│   │       ├── AISalesChat.jsx           # Main chat widget component
│   │       ├── ChatMessage.jsx           # Individual message component
│   │       ├── ChatInput.jsx             # Input with typing indicators
│   │       ├── PaymentEmbed.jsx          # Embedded Stripe payment
│   │       ├── ConfigPanel.jsx           # Business owner config UI
│   │       ├── IntentIndicator.jsx       # Visual intent score display
│   │       └── index.js                  # Export barrel
│   │
│   ├── hooks/
│   │   ├── useVisitorIntent.js          # Main intent detection hook
│   │   ├── useAIChat.js                 # Chat state and operations
│   │   ├── usePaymentFlow.js            # Payment processing hook
│   │   └── useAISalesAnalytics.js       # Analytics tracking hook
│   │
│   ├── lib/
│   │   ├── ai-sales/
│   │   │   ├── openai-client.js         # OpenAI configuration
│   │   │   ├── chat-engine.js           # Core chat logic
│   │   │   ├── tools.js                 # Function calling tools
│   │   │   ├── prompts.js               # System prompts
│   │   │   └── optimizer.js             # ML optimization logic
│   │   ├── visitor-tracking/
│   │   │   ├── signals.js               # Signal definitions
│   │   │   ├── intent-scorer.js         # Scoring algorithm
│   │   │   └── tracker.js               # Event tracking
│   │   ├── stripe/
│   │   │   ├── ai-payment.js            # AI-specific payment logic
│   │   │   └── connect-helpers.js       # Stripe Connect utilities
│   │   └── analytics/
│   │       ├── ai-events.js             # Event definitions
│   │       └── conversion-tracker.js     # Conversion tracking
│   │
│   ├── stores/
│   │   ├── ai-chat-store.js             # Zustand chat state
│   │   ├── visitor-intent-store.js      # Intent tracking state
│   │   └── ai-config-store.js           # Agent configuration state
│   │
│   └── types/
│       └── ai-sales.js                  # JSDoc type definitions
│
└── tests/
    ├── unit/
    │   ├── intent-scoring.test.js
    │   ├── ai-tools.test.js
    │   └── payment-flow.test.js
    └── integration/
        └── chat-to-payment.test.js
```

## Data Flow

### 1. Visitor Landing → Intent Detection
```
Visitor lands on page
    ↓
useVisitorIntent hook initializes
    ↓
Tracks: mouse velocity, scroll depth, CTA interactions, pricing views
    ↓
Calculates real-time intent score
    ↓
Triggers AI chat when threshold met
```

### 2. AI Engagement → Conversation
```
AI chat widget opens (animated)
    ↓
Initial greeting based on visitor context
    ↓
Streaming responses via SSE/WebSocket
    ↓
Function calling for actions (offer_discount, process_payment)
    ↓
Conversation stored in Zustand + Supabase
```

### 3. Purchase Intent → Payment
```
AI detects purchase readiness
    ↓
Generates personalized offer
    ↓
Embeds Stripe Payment Element in chat
    ↓
Processes payment via Stripe Connect
    ↓
Confirms order and follows up
```

### 4. Analytics → Optimization
```
All interactions tracked to PostHog
    ↓
Conversion patterns analyzed
    ↓
A/B test results evaluated
    ↓
AI strategy updated weekly
    ↓
Insights fed back to prompt optimization
```

## Key Dependencies

### New NPM Packages Needed
```json
{
  "dependencies": {
    // State Management
    "zustand": "^4.5.2",
    "@tanstack/react-query": "^5.28.0",
    
    // UI & Animations
    "framer-motion": "^11.0.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    
    // Stripe
    "@stripe/stripe-js": "^3.0.0",
    "@stripe/react-stripe-js": "^2.5.0",
    
    // Analytics
    "posthog-js": "^1.116.0",
    
    // Rate Limiting
    "rate-limiter-flexible": "^3.0.0",
    
    // Utilities
    "zod": "^3.22.0",
    "date-fns": "^3.3.0",
    "lodash.debounce": "^4.0.8"
  },
  "devDependencies": {
    // Testing
    "@testing-library/react": "^14.2.0",
    "@testing-library/jest-dom": "^6.4.0",
    "jest": "^29.7.0",
    "msw": "^2.2.0"
  }
}
```

## JavaScript Object Schemas

```javascript
/**
 * @fileoverview AI Sales type definitions using JSDoc
 */

/**
 * Visitor behavior signals for intent detection
 * @typedef {Object} VisitorSignals
 * @property {number} mouseVelocity - Average mouse movement speed (px/s)
 * @property {number} scrollDepth - Maximum scroll percentage reached (0-100)
 * @property {number} timeOnPage - Time spent on page in seconds
 * @property {number} ctaHovers - Number of CTA button hover events
 * @property {number} pricingViews - Number of times pricing was viewed
 * @property {boolean} exitIntent - Whether exit intent was detected
 * @property {number} inactivityPeriods - Count of inactive periods > 5s
 * @property {string[]} viewedProducts - Array of product IDs viewed
 * @property {Object} deviceInfo - Device and browser information
 * @property {string} deviceInfo.type - 'mobile' | 'tablet' | 'desktop'
 * @property {string} deviceInfo.browser - Browser name
 * @property {string} referrer - Traffic source
 */

/**
 * AI agent conversation context
 * @typedef {Object} AIAgentContext
 * @property {string} sessionId - Unique session identifier
 * @property {string} visitorId - Anonymous visitor ID
 * @property {VisitorSignals} signals - Current visitor signals
 * @property {number} intentScore - Calculated intent score (0-100)
 * @property {string} stage - 'awareness' | 'consideration' | 'decision' | 'purchase'
 * @property {Object} businessContext - Business-specific information
 * @property {string} businessContext.id - Business ID
 * @property {string} businessContext.name - Business name
 * @property {Object[]} businessContext.products - Available products
 * @property {PricingRules} businessContext.pricingRules - Pricing boundaries
 * @property {Message[]} conversationHistory - Chat history
 * @property {Object} currentOffer - Active offer if any
 * @property {number} currentOffer.amount - Offer amount
 * @property {string} currentOffer.type - 'discount' | 'bonus' | 'bundle'
 * @property {number} currentOffer.expiresAt - Unix timestamp
 */

/**
 * Business-defined pricing rules and boundaries
 * @typedef {Object} PricingRules
 * @property {number} basePrice - Standard price
 * @property {number} minPrice - Minimum allowed price
 * @property {number} maxDiscount - Maximum discount percentage
 * @property {Object[]} volumeDiscounts - Volume-based pricing tiers
 * @property {number} volumeDiscounts[].quantity - Minimum quantity
 * @property {number} volumeDiscounts[].discount - Discount percentage
 * @property {Object[]} urgencyMultipliers - Time-based pricing
 * @property {string} urgencyMultipliers[].trigger - 'exit_intent' | 'high_engagement' | 'return_visitor'
 * @property {number} urgencyMultipliers[].multiplier - Price adjustment factor
 * @property {boolean} allowNegotiation - Whether AI can negotiate
 * @property {string[]} approvedPaymentMethods - ['card', 'bank', 'crypto']
 */

/**
 * Sales conversation pattern for optimization
 * @typedef {Object} SalesPattern
 * @property {string} id - Unique pattern ID
 * @property {string} opener - Opening message template
 * @property {string[]} objectionHandlers - Common objection responses
 * @property {string} closingStrategy - 'soft' | 'assumptive' | 'urgency' | 'value'
 * @property {Object} performance - Performance metrics
 * @property {number} performance.conversionRate - Success rate (0-1)
 * @property {number} performance.avgDealSize - Average transaction value
 * @property {number} performance.avgTimeToClose - Seconds to conversion
 * @property {number} performance.sampleSize - Number of conversations
 * @property {Object} segmentation - Applicable visitor segments
 * @property {string[]} segmentation.sources - Traffic sources
 * @property {string[]} segmentation.devices - Device types
 * @property {Object} segmentation.intentRange - Intent score range
 * @property {number} segmentation.intentRange.min - Minimum score
 * @property {number} segmentation.intentRange.max - Maximum score
 */

/**
 * Chat message structure
 * @typedef {Object} Message
 * @property {string} id - Message ID
 * @property {string} role - 'user' | 'assistant' | 'system'
 * @property {string} content - Message text
 * @property {number} timestamp - Unix timestamp
 * @property {Object} metadata - Additional message data
 * @property {string} metadata.intentStage - Current intent stage
 * @property {Object} metadata.functionCall - Function call data if any
 * @property {boolean} metadata.isPaymentRequest - Whether message contains payment UI
 */

/**
 * AI function call definitions
 * @typedef {Object} AIFunction
 * @property {string} name - Function name
 * @property {string} description - What the function does
 * @property {Object} parameters - Function parameters schema
 * @property {Function} handler - Async function implementation
 */

/**
 * Payment session data
 * @typedef {Object} PaymentSession
 * @property {string} id - Session ID
 * @property {string} stripeSessionId - Stripe checkout session ID
 * @property {number} amount - Payment amount in cents
 * @property {string} currency - Three-letter currency code
 * @property {Object} lineItems - Items being purchased
 * @property {string} status - 'pending' | 'processing' | 'completed' | 'failed'
 * @property {Object} customer - Customer information
 * @property {string} customer.email - Customer email
 * @property {string} customer.visitorId - Linked visitor ID
 * @property {string} aiConversationId - Related chat session
 */
```

## Security Considerations

1. **API Keys**: All sensitive keys stored in environment variables
2. **Rate Limiting**: 10 messages/minute per IP to prevent abuse
3. **Input Sanitization**: All user inputs sanitized before AI processing
4. **Payment Security**: PCI DSS compliance via Stripe's embedded elements
5. **Data Privacy**: GDPR-compliant with anonymized visitor tracking
6. **Webhook Verification**: Stripe webhook signatures validated
7. **CORS**: Properly configured for subdomain isolation

## Performance Requirements

- **Chat Load Time**: < 500ms widget initialization
- **AI Response Time**: < 2s for first token, streaming thereafter
- **Payment Load**: < 1s for Stripe element mounting
- **Intent Detection**: Real-time with 16ms debounce
- **Analytics**: Async batch processing every 30s

## Architecture Decisions

1. **Zustand over Redux**: Lighter weight for chat state management
2. **SSE over WebSockets**: Simpler implementation for one-way streaming
3. **Edge Functions**: Where possible for lower latency
4. **Supabase Realtime**: For multi-tab chat synchronization
5. **PostHog over Custom**: Proven analytics with A/B testing built-in
6. **Function Calling**: OpenAI native vs custom parsing for reliability

## Next Steps

With this architecture defined, we'll proceed to Step 2: Building the Chat Widget Skeleton.