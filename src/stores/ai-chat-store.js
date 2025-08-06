/**
 * @fileoverview Zustand store for AI Sales Chat state management
 * Handles chat visibility, messages, and UI state
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';

/**
 * @typedef {import('../types/ai-sales').Message} Message
 */

const useAIChatStore = create((set, get) => ({
  // Chat visibility state
  isOpen: false,
  isMinimized: false,
  hasNewMessage: false,
  
  // Messages
  messages: [
    // Sample hardcoded messages for skeleton
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hi there! I noticed you've been exploring our solutions. How can I help you today?",
      timestamp: Date.now() - 60000,
      metadata: {
        intentStage: 'awareness',
        isPaymentRequest: false
      }
    }
  ],
  
  // Typing state
  isTyping: false,
  typingMessage: '',
  
  // User interaction state
  lastInteractionTime: Date.now(),
  sessionStartTime: Date.now(),
  
  // Configuration
  config: {
    position: 'bottom-right', // bottom-right, bottom-left
    theme: 'light', // light, dark, auto
    soundEnabled: true,
    animationSpeed: 'normal' // slow, normal, fast
  },
  
  // Actions
  toggleChat: () => set((state) => ({
    isOpen: !state.isOpen,
    hasNewMessage: false,
    lastInteractionTime: Date.now()
  })),
  
  minimizeChat: () => set({
    isMinimized: true,
    isOpen: false
  }),
  
  maximizeChat: () => set({
    isMinimized: false,
    isOpen: true,
    hasNewMessage: false
  }),
  
  closeChat: () => set({
    isOpen: false,
    isMinimized: false,
    hasNewMessage: false
  }),
  
  /**
   * Add a new message to the chat
   * @param {Partial<Message>} message - Message to add
   */
  addMessage: (message) => {
    const newMessage = {
      id: message.id || nanoid(),
      timestamp: Date.now(),
      metadata: {
        intentStage: 'consideration',
        isPaymentRequest: false,
        ...message.metadata
      },
      ...message
    };
    
    set((state) => ({
      messages: [...state.messages, newMessage],
      hasNewMessage: !state.isOpen && message.role === 'assistant',
      lastInteractionTime: Date.now()
    }));
  },
  
  /**
   * Update typing indicator
   * @param {boolean} isTyping - Whether AI is typing
   * @param {string} message - Preview of typing message
   */
  setTyping: (isTyping, message = '') => set({
    isTyping,
    typingMessage: message
  }),
  
  /**
   * Clear all messages (for testing)
   */
  clearMessages: () => set({
    messages: [],
    hasNewMessage: false
  }),
  
  /**
   * Update configuration
   * @param {Object} config - Configuration updates
   */
  updateConfig: (config) => set((state) => ({
    config: { ...state.config, ...config }
  })),
  
  /**
   * Get current session duration in seconds
   */
  getSessionDuration: () => {
    const state = get();
    return Math.floor((Date.now() - state.sessionStartTime) / 1000);
  },
  
  /**
   * Check if user is inactive
   * @param {number} threshold - Inactivity threshold in ms
   */
  isUserInactive: (threshold = 30000) => {
    const state = get();
    return Date.now() - state.lastInteractionTime > threshold;
  }
}));

export default useAIChatStore;