/**
 * @fileoverview Zustand store for AI Sales Agent configuration
 * Handles business owner settings and preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * @typedef {import('../types/ai-sales').AIAgentConfig} AIAgentConfig
 * @typedef {import('../types/ai-sales').PricingRules} PricingRules
 */

const defaultConfig = {
  businessId: null,
  
  // AI Personality
  personality: {
    tone: 'friendly', // professional, friendly, casual, enthusiastic
    avatar: null,
    name: 'Sales Assistant',
    greeting: 'Hi there! How can I help you today?',
    signature: 'Best regards'
  },
  
  // Business Knowledge
  knowledge: {
    businessDescription: '',
    products: [],
    faqs: [],
    objectionHandlers: [
      {
        objection: 'too expensive',
        response: 'I understand price is important. Let me show you the value and ROI our solution provides.'
      },
      {
        objection: 'need to think about it',
        response: 'Of course! What specific aspects would help you make the best decision?'
      },
      {
        objection: 'not ready yet',
        response: 'No problem! When do you think you might be ready? I can send you some helpful resources.'
      }
    ]
  },
  
  // Pricing Configuration
  pricing: {
    basePrice: 99,
    minPrice: 49,
    maxDiscount: 30,
    allowNegotiation: true,
    approvedPaymentMethods: ['card'],
    volumeDiscounts: [],
    urgencyMultipliers: [
      { trigger: 'exit_intent', multiplier: 0.85 }, // 15% discount
      { trigger: 'high_engagement', multiplier: 0.9 }, // 10% discount
      { trigger: 'return_visitor', multiplier: 0.95 } // 5% discount
    ]
  },
  
  // Trigger Configuration
  triggers: {
    intentThreshold: 45,
    timeDelay: 30,
    exitIntentEnabled: true,
    proactiveMessages: true,
    workingHoursOnly: false,
    workingHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York',
      weekdays: [1, 2, 3, 4, 5] // Monday-Friday
    }
  },
  
  // Business Goals
  goals: {
    primary: 'maximize_revenue', // maximize_revenue, maximize_conversions, maximize_aov
    targetConversionRate: 5,
    targetAOV: 299,
    focusProducts: []
  },
  
  // Advanced Settings
  advanced: {
    aggressiveness: 'medium', // low, medium, high
    fallbackToHuman: true,
    humanHandoffThreshold: 3, // number of failed attempts
    collectFeedback: true,
    a11yCompliant: true
  }
};

const useAIConfigStore = create(
  persist(
    (set, get) => ({
      ...defaultConfig,
      
      // Loading state
      isLoading: false,
      error: null,
      lastSaved: null,
      hasUnsavedChanges: false,
      
      /**
       * Update personality settings
       * @param {Object} personality - Personality updates
       */
      updatePersonality: (personality) => set((state) => ({
        personality: { ...state.personality, ...personality },
        hasUnsavedChanges: true
      })),
      
      /**
       * Update business knowledge
       * @param {Object} knowledge - Knowledge updates
       */
      updateKnowledge: (knowledge) => set((state) => ({
        knowledge: { ...state.knowledge, ...knowledge },
        hasUnsavedChanges: true
      })),
      
      /**
       * Add or update a product
       * @param {Object} product - Product data
       */
      updateProduct: (product) => set((state) => {
        const products = [...state.knowledge.products];
        const existingIndex = products.findIndex(p => p.id === product.id);
        
        if (existingIndex >= 0) {
          products[existingIndex] = product;
        } else {
          products.push({ id: Date.now().toString(), ...product });
        }
        
        return {
          knowledge: { ...state.knowledge, products },
          hasUnsavedChanges: true
        };
      }),
      
      /**
       * Remove a product
       * @param {string} productId - Product ID to remove
       */
      removeProduct: (productId) => set((state) => ({
        knowledge: {
          ...state.knowledge,
          products: state.knowledge.products.filter(p => p.id !== productId)
        },
        hasUnsavedChanges: true
      })),
      
      /**
       * Add or update FAQ
       * @param {Object} faq - FAQ data
       */
      updateFAQ: (faq) => set((state) => {
        const faqs = [...state.knowledge.faqs];
        const existingIndex = faqs.findIndex(f => f.id === faq.id);
        
        if (existingIndex >= 0) {
          faqs[existingIndex] = faq;
        } else {
          faqs.push({ id: Date.now().toString(), ...faq });
        }
        
        return {
          knowledge: { ...state.knowledge, faqs },
          hasUnsavedChanges: true
        };
      }),
      
      /**
       * Remove FAQ
       * @param {string} faqId - FAQ ID to remove
       */
      removeFAQ: (faqId) => set((state) => ({
        knowledge: {
          ...state.knowledge,
          faqs: state.knowledge.faqs.filter(f => f.id !== faqId)
        },
        hasUnsavedChanges: true
      })),
      
      /**
       * Update objection handler
       * @param {number} index - Handler index
       * @param {Object} handler - Handler data
       */
      updateObjectionHandler: (index, handler) => set((state) => {
        const handlers = [...state.knowledge.objectionHandlers];
        handlers[index] = handler;
        
        return {
          knowledge: { ...state.knowledge, objectionHandlers: handlers },
          hasUnsavedChanges: true
        };
      }),
      
      /**
       * Add objection handler
       * @param {Object} handler - Handler data
       */
      addObjectionHandler: (handler) => set((state) => ({
        knowledge: {
          ...state.knowledge,
          objectionHandlers: [...state.knowledge.objectionHandlers, handler]
        },
        hasUnsavedChanges: true
      })),
      
      /**
       * Remove objection handler
       * @param {number} index - Handler index
       */
      removeObjectionHandler: (index) => set((state) => ({
        knowledge: {
          ...state.knowledge,
          objectionHandlers: state.knowledge.objectionHandlers.filter((_, i) => i !== index)
        },
        hasUnsavedChanges: true
      })),
      
      /**
       * Update pricing configuration
       * @param {Object} pricing - Pricing updates
       */
      updatePricing: (pricing) => set((state) => ({
        pricing: { ...state.pricing, ...pricing },
        hasUnsavedChanges: true
      })),
      
      /**
       * Update trigger settings
       * @param {Object} triggers - Trigger updates
       */
      updateTriggers: (triggers) => set((state) => ({
        triggers: { ...state.triggers, ...triggers },
        hasUnsavedChanges: true
      })),
      
      /**
       * Update business goals
       * @param {Object} goals - Goals updates
       */
      updateGoals: (goals) => set((state) => ({
        goals: { ...state.goals, ...goals },
        hasUnsavedChanges: true
      })),
      
      /**
       * Update advanced settings
       * @param {Object} advanced - Advanced settings updates
       */
      updateAdvanced: (advanced) => set((state) => ({
        advanced: { ...state.advanced, ...advanced },
        hasUnsavedChanges: true
      })),
      
      /**
       * Save configuration to backend
       */
      saveConfiguration: async () => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          const config = {
            businessId: state.businessId,
            personality: state.personality,
            knowledge: state.knowledge,
            pricing: state.pricing,
            triggers: state.triggers,
            goals: state.goals,
            advanced: state.advanced
          };
          
          const response = await fetch('/api/ai-sales/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(config)
          });
          
          if (!response.ok) {
            throw new Error('Failed to save configuration');
          }
          
          set({
            isLoading: false,
            lastSaved: new Date().toISOString(),
            hasUnsavedChanges: false
          });
          
          return true;
        } catch (error) {
          set({
            isLoading: false,
            error: error.message
          });
          return false;
        }
      },
      
      /**
       * Load configuration from backend
       * @param {string} businessId - Business ID
       */
      loadConfiguration: async (businessId) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`/api/ai-sales/config?businessId=${businessId}`);
          
          if (!response.ok) {
            throw new Error('Failed to load configuration');
          }
          
          const config = await response.json();
          
          set({
            ...config,
            businessId,
            isLoading: false,
            hasUnsavedChanges: false
          });
          
          return true;
        } catch (error) {
          set({
            isLoading: false,
            error: error.message
          });
          return false;
        }
      },
      
      /**
       * Reset to defaults
       */
      resetToDefaults: () => set({
        ...defaultConfig,
        hasUnsavedChanges: true
      }),
      
      /**
       * Clear error
       */
      clearError: () => set({ error: null }),
      
      /**
       * Get current configuration as exportable object
       */
      exportConfiguration: () => {
        const state = get();
        return {
          personality: state.personality,
          knowledge: state.knowledge,
          pricing: state.pricing,
          triggers: state.triggers,
          goals: state.goals,
          advanced: state.advanced,
          exportedAt: new Date().toISOString()
        };
      },
      
      /**
       * Import configuration from object
       * @param {Object} config - Configuration to import
       */
      importConfiguration: (config) => set((state) => ({
        ...state,
        ...config,
        hasUnsavedChanges: true
      }))
    }),
    {
      name: 'ai-sales-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        businessId: state.businessId,
        personality: state.personality,
        knowledge: state.knowledge,
        pricing: state.pricing,
        triggers: state.triggers,
        goals: state.goals,
        advanced: state.advanced
      })
    }
  )
);

export default useAIConfigStore;