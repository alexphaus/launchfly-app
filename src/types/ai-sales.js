/**
 * @fileoverview AI Sales type definitions using JSDoc
 * These types define the structure of data used throughout the AI Revenue Autopilot feature
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

/**
 * Analytics event structure
 * @typedef {Object} AIAnalyticsEvent
 * @property {string} event - Event name
 * @property {string} visitorId - Anonymous visitor ID
 * @property {string} sessionId - Session ID
 * @property {Object} properties - Event-specific properties
 * @property {number} timestamp - Unix timestamp
 * @property {Object} context - Additional context
 * @property {string} context.page - Current page URL
 * @property {string} context.aiStage - Current AI conversation stage
 * @property {number} context.intentScore - Current intent score
 */

/**
 * AI configuration for business owners
 * @typedef {Object} AIAgentConfig
 * @property {string} businessId - Business ID
 * @property {Object} personality - AI personality settings
 * @property {string} personality.tone - 'professional' | 'friendly' | 'casual' | 'enthusiastic'
 * @property {string} personality.avatar - Avatar image URL
 * @property {string} personality.name - Agent name
 * @property {Object} knowledge - Business knowledge base
 * @property {string} knowledge.businessDescription - What the business does
 * @property {Object[]} knowledge.products - Product catalog
 * @property {string[]} knowledge.faqs - Common questions and answers
 * @property {string[]} knowledge.objectionHandlers - Objection handling scripts
 * @property {PricingRules} pricing - Pricing configuration
 * @property {Object} triggers - When to activate AI
 * @property {number} triggers.intentThreshold - Intent score to trigger chat (0-100)
 * @property {number} triggers.timeDelay - Seconds before showing chat
 * @property {boolean} triggers.exitIntentEnabled - Trigger on exit intent
 * @property {Object} goals - Business goals
 * @property {string} goals.primary - 'maximize_revenue' | 'maximize_conversions' | 'maximize_aov'
 * @property {number} goals.targetConversionRate - Target conversion percentage
 */

// Export empty object to make this a module
export {};