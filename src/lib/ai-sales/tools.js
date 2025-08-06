/**
 * @fileoverview Function calling tools for AI Sales Agent
 * Defines available functions the AI can call during conversations
 */

/**
 * @typedef {import('../../types/ai-sales').AIAgentContext} AIAgentContext
 * @typedef {import('../../types/ai-sales').PricingRules} PricingRules
 */

/**
 * Function definitions for OpenAI function calling
 */
export const availableFunctions = [
  {
    name: 'process_payment',
    description: 'Initiate payment processing when the customer is ready to purchase',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The ID of the product being purchased'
        },
        quantity: {
          type: 'number',
          description: 'Quantity of the product',
          default: 1
        },
        discountCode: {
          type: 'string',
          description: 'Optional discount code to apply'
        },
        customerEmail: {
          type: 'string',
          description: 'Customer email address for the order'
        }
      },
      required: ['productId', 'customerEmail']
    }
  },
  {
    name: 'offer_discount',
    description: 'Offer a personalized discount to help close the sale',
    parameters: {
      type: 'object',
      properties: {
        discountType: {
          type: 'string',
          enum: ['percentage', 'fixed'],
          description: 'Type of discount to offer'
        },
        discountValue: {
          type: 'number',
          description: 'Discount amount (percentage or fixed dollar amount)'
        },
        reason: {
          type: 'string',
          description: 'Reason for offering the discount',
          enum: ['first_time', 'bulk_purchase', 'limited_time', 'engagement_bonus']
        },
        expiryMinutes: {
          type: 'number',
          description: 'Minutes until the discount expires',
          default: 30
        }
      },
      required: ['discountType', 'discountValue', 'reason']
    }
  },
  {
    name: 'check_inventory',
    description: 'Check product availability and stock levels',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The ID of the product to check'
        }
      },
      required: ['productId']
    }
  },
  {
    name: 'schedule_demo',
    description: 'Schedule a product demo or consultation',
    parameters: {
      type: 'object',
      properties: {
        customerName: {
          type: 'string',
          description: 'Customer name'
        },
        customerEmail: {
          type: 'string',
          description: 'Customer email'
        },
        preferredTime: {
          type: 'string',
          description: 'Preferred demo time'
        },
        productInterest: {
          type: 'string',
          description: 'Product they are interested in'
        }
      },
      required: ['customerName', 'customerEmail']
    }
  },
  {
    name: 'calculate_roi',
    description: 'Calculate potential ROI based on customer inputs',
    parameters: {
      type: 'object',
      properties: {
        currentSolution: {
          type: 'string',
          description: 'Their current solution or approach'
        },
        monthlyVolume: {
          type: 'number',
          description: 'Monthly transaction/usage volume'
        },
        currentCost: {
          type: 'number',
          description: 'Current monthly cost'
        }
      },
      required: ['monthlyVolume']
    }
  }
];

/**
 * Function handlers - actual implementations
 */
export const functionHandlers = {
  /**
   * Process payment for a product
   * @param {Object} args - Function arguments
   * @param {AIAgentContext} context - Current conversation context
   * @returns {Object} Payment session data
   */
  async process_payment(args, context) {
    const { productId, quantity = 1, discountCode, customerEmail } = args;
    const { businessContext, currentOffer } = context;
    
    // Find the product
    const product = businessContext.products.find(p => p.id === productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Calculate price with any discounts
    let finalPrice = product.price * quantity;
    if (currentOffer && currentOffer.type === 'discount') {
      finalPrice = finalPrice * (1 - currentOffer.amount / 100);
    }
    
    // Return payment session data for the API to process
    return {
      action: 'create_payment_session',
      data: {
        productId,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        finalPrice,
        discountApplied: currentOffer ? currentOffer.amount : 0,
        customerEmail,
        metadata: {
          conversationId: context.sessionId,
          aiAssisted: true,
          stage: context.stage
        }
      }
    };
  },
  
  /**
   * Generate a discount offer
   * @param {Object} args - Function arguments
   * @param {AIAgentContext} context - Current conversation context
   * @returns {Object} Discount offer data
   */
  async offer_discount(args, context) {
    const { discountType, discountValue, reason, expiryMinutes = 30 } = args;
    const { businessContext } = context;
    const { pricingRules } = businessContext;
    
    // Validate discount against pricing rules
    if (discountType === 'percentage' && discountValue > pricingRules.maxDiscount) {
      throw new Error(`Discount exceeds maximum allowed (${pricingRules.maxDiscount}%)`);
    }
    
    const expiresAt = Date.now() + (expiryMinutes * 60 * 1000);
    
    return {
      action: 'create_discount',
      data: {
        type: discountType,
        value: discountValue,
        reason,
        code: `AI${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        expiresAt,
        terms: discountType === 'percentage' 
          ? `${discountValue}% off your purchase`
          : `$${discountValue} off your purchase`
      }
    };
  },
  
  /**
   * Check inventory status
   * @param {Object} args - Function arguments
   * @returns {Object} Inventory data
   */
  async check_inventory(args) {
    const { productId } = args;
    
    // Simulate inventory check
    // In production, this would query your inventory system
    return {
      action: 'inventory_status',
      data: {
        productId,
        inStock: true,
        quantity: Math.floor(Math.random() * 100) + 10,
        lowStock: Math.random() > 0.8
      }
    };
  },
  
  /**
   * Schedule a demo
   * @param {Object} args - Function arguments
   * @returns {Object} Demo scheduling data
   */
  async schedule_demo(args) {
    const { customerName, customerEmail, preferredTime, productInterest } = args;
    
    return {
      action: 'schedule_demo',
      data: {
        customerName,
        customerEmail,
        preferredTime: preferredTime || 'Next available slot',
        productInterest,
        confirmationRequired: true,
        demoLink: 'https://calendly.com/demo' // Placeholder
      }
    };
  },
  
  /**
   * Calculate ROI
   * @param {Object} args - Function arguments
   * @returns {Object} ROI calculation
   */
  async calculate_roi(args) {
    const { currentSolution, monthlyVolume, currentCost = 0 } = args;
    
    // Simple ROI calculation
    const ourCost = monthlyVolume * 0.5; // Example: $0.50 per transaction
    const savings = Math.max(0, currentCost - ourCost);
    const roi = currentCost > 0 ? (savings / currentCost) * 100 : 0;
    
    return {
      action: 'roi_calculation',
      data: {
        currentSolution,
        monthlyVolume,
        currentCost,
        projectedCost: ourCost,
        monthlySavings: savings,
        annualSavings: savings * 12,
        roiPercentage: Math.round(roi),
        breakEvenDays: ourCost > 0 ? Math.round(299 / (savings / 30)) : 0
      }
    };
  }
};

/**
 * Process function call from AI
 * @param {string} functionName - Name of function to call
 * @param {Object} args - Function arguments
 * @param {AIAgentContext} context - Current context
 * @returns {Object} Function result
 */
export async function processFunctionCall(functionName, args, context) {
  const handler = functionHandlers[functionName];
  if (!handler) {
    throw new Error(`Unknown function: ${functionName}`);
  }
  
  try {
    const result = await handler(args, context);
    return {
      success: true,
      functionName,
      result
    };
  } catch (error) {
    return {
      success: false,
      functionName,
      error: error.message
    };
  }
}