/**
 * @fileoverview React hook for AI chat operations and state management
 */

import { useCallback, useEffect, useRef } from 'react';
import useAIChatStore from '../stores/ai-chat-store';
import { nanoid } from 'nanoid';

/**
 * Hook for managing AI chat functionality
 * @param {Object} options - Hook options
 * @param {string} options.businessId - Business ID
 * @param {Function} options.onMessageSent - Callback when message is sent
 * @param {Function} options.onChatOpened - Callback when chat is opened
 * @param {Function} options.onChatClosed - Callback when chat is closed
 * @returns {Object} Chat state and methods
 */
export const useAIChat = (options = {}) => {
  const { businessId, onMessageSent, onChatOpened, onChatClosed } = options;
  const prevIsOpenRef = useRef(false);
  
  const {
    isOpen,
    isMinimized,
    hasNewMessage,
    messages,
    isTyping,
    config,
    toggleChat,
    minimizeChat,
    maximizeChat,
    closeChat,
    addMessage,
    setTyping,
    clearMessages,
    updateConfig,
    getSessionDuration,
    isUserInactive
  } = useAIChatStore();
  
  // Track chat open/close events
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      onChatOpened?.();
    } else if (!isOpen && prevIsOpenRef.current) {
      onChatClosed?.();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, onChatOpened, onChatClosed]);
  
  /**
   * Send a message in the chat
   * @param {string} content - Message content
   * @param {Object} metadata - Additional metadata
   */
  const sendMessage = useCallback(async (content, metadata = {}) => {
    if (!content.trim()) return;
    
    const userMessage = {
      id: nanoid(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      metadata: {
        businessId,
        ...metadata
      }
    };
    
    addMessage(userMessage);
    onMessageSent?.(userMessage);
    
    // Return the message for further processing
    return userMessage;
  }, [businessId, addMessage, onMessageSent]);
  
  /**
   * Simulate AI typing indicator
   * @param {number} duration - Duration in ms
   * @param {string} preview - Preview text
   */
  const simulateTyping = useCallback((duration = 2000, preview = '') => {
    setTyping(true, preview);
    return new Promise((resolve) => {
      setTimeout(() => {
        setTyping(false);
        resolve();
      }, duration);
    });
  }, [setTyping]);
  
  /**
   * Add an AI response
   * @param {string} content - Response content
   * @param {Object} metadata - Additional metadata
   */
  const addAIResponse = useCallback((content, metadata = {}) => {
    const aiMessage = {
      id: nanoid(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        businessId,
        ...metadata
      }
    };
    
    addMessage(aiMessage);
    return aiMessage;
  }, [businessId, addMessage]);
  
  /**
   * Add a system message
   * @param {string} content - System message content
   */
  const addSystemMessage = useCallback((content) => {
    const systemMessage = {
      id: nanoid(),
      role: 'system',
      content,
      timestamp: Date.now(),
      metadata: {
        businessId
      }
    };
    
    addMessage(systemMessage);
    return systemMessage;
  }, [businessId, addMessage]);
  
  /**
   * Get conversation context for AI
   */
  const getConversationContext = useCallback(() => {
    return {
      messages: messages.slice(-10), // Last 10 messages
      sessionDuration: getSessionDuration(),
      isUserInactive: isUserInactive(),
      businessId
    };
  }, [messages, getSessionDuration, isUserInactive, businessId]);
  
  /**
   * Check if should show proactive message
   */
  const shouldShowProactiveMessage = useCallback(() => {
    const sessionDuration = getSessionDuration();
    const lastMessage = messages[messages.length - 1];
    const timeSinceLastMessage = lastMessage 
      ? Date.now() - lastMessage.timestamp 
      : sessionDuration * 1000;
    
    // Show proactive message after 30s of inactivity
    return timeSinceLastMessage > 30000 && messages.length < 3;
  }, [messages, getSessionDuration]);
  
  return {
    // State
    isOpen,
    isMinimized,
    hasNewMessage,
    messages,
    isTyping,
    config,
    
    // Actions
    toggleChat,
    minimizeChat,
    maximizeChat,
    closeChat,
    sendMessage,
    simulateTyping,
    addAIResponse,
    addSystemMessage,
    clearMessages,
    updateConfig,
    
    // Utilities
    getConversationContext,
    getSessionDuration,
    isUserInactive,
    shouldShowProactiveMessage
  };
};