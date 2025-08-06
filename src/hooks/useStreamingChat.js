/**
 * @fileoverview Hook for streaming chat communication with AI
 * Handles SSE connection and real-time message updates
 */

import { useState, useCallback, useRef } from 'react';
import useAIChatStore from '../stores/ai-chat-store';

/**
 * Hook for streaming AI chat communication
 * @param {Object} options - Configuration options
 * @param {string} options.businessId - Business ID
 * @param {string} options.sessionId - Session ID  
 * @param {string} options.visitorId - Visitor ID
 * @returns {Object} Streaming chat utilities
 */
export const useStreamingChat = (options = {}) => {
  const { businessId, sessionId, visitorId } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const contextRef = useRef(null);
  
  const { addMessage, setTyping } = useAIChatStore();
  
  /**
   * Send a message and handle streaming response
   * @param {string} message - Message to send
   * @param {Object} context - Current conversation context
   * @returns {Promise} Promise that resolves when stream completes
   */
  const sendMessage = useCallback(async (message, context = null) => {
    if (!businessId || !sessionId || !visitorId) {
      throw new Error('Missing required configuration: businessId, sessionId, visitorId');
    }
    
    setError(null);
    setTyping(true, 'Thinking...');
    
    try {
      // Send message to API
      const response = await fetch('/api/ai-sales/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          visitorId,
          businessId,
          context: context || contextRef.current,
          signals: getCurrentSignals()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      let aiResponse = '';
      
      setIsConnected(true);
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setTyping(false);
              setIsConnected(false);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content') {
                aiResponse += parsed.content;
                // Update typing indicator with preview
                setTyping(true, aiResponse);
              } else if (parsed.type === 'function_call') {
                // Handle function call results
                handleFunctionCall(parsed);
              } else if (parsed.type === 'context_update') {
                // Update conversation context
                contextRef.current = parsed.context;
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
      
      // Add final AI response
      if (aiResponse) {
        setTyping(false);
        addMessage({
          role: 'assistant',
          content: aiResponse,
          metadata: {
            intentStage: contextRef.current?.stage || 'consideration'
          }
        });
      }
      
    } catch (error) {
      console.error('Streaming chat error:', error);
      setError(error.message);
      setTyping(false);
      
      // Add error message
      addMessage({
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or contact support if the issue persists.',
        metadata: {
          isError: true
        }
      });
    } finally {
      setIsConnected(false);
    }
  }, [businessId, sessionId, visitorId, addMessage, setTyping]);
  
  /**
   * Get initial AI greeting
   * @returns {Promise} Promise that resolves with greeting
   */
  const getInitialGreeting = useCallback(async () => {
    if (!businessId || !sessionId || !visitorId) {
      return null;
    }
    
    try {
      const response = await fetch('/api/ai-sales/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          visitorId,
          businessId,
          signals: getCurrentSignals()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get greeting');
      }
      
      const data = await response.json();
      contextRef.current = data.context;
      
      return data.response;
    } catch (error) {
      console.error('Failed to get initial greeting:', error);
      return "Hi there! I'm here to help you find the perfect solution. How can I assist you today?";
    }
  }, [businessId, sessionId, visitorId]);
  
  /**
   * Handle function call results
   * @param {Object} functionData - Function call data
   */
  const handleFunctionCall = useCallback((functionData) => {
    const { functionCall, result } = functionData;
    
    if (functionCall === 'process_payment' && result.success) {
      // Handle payment processing
      addMessage({
        role: 'assistant',
        content: 'Perfect! I\'m setting up your payment now...',
        metadata: {
          isPaymentRequest: true,
          paymentData: result.result.data
        }
      });
    } else if (functionCall === 'offer_discount' && result.success) {
      // Handle discount offer
      const discountData = result.result.data;
      addMessage({
        role: 'assistant',
        content: `Great news! I can offer you ${discountData.terms}. This special offer expires in ${Math.round((discountData.expiresAt - Date.now()) / 60000)} minutes.`,
        metadata: {
          isOffer: true,
          offerData: discountData
        }
      });
    }
  }, [addMessage]);
  
  /**
   * Get current visitor signals
   * @returns {Object} Current signals
   */
  const getCurrentSignals = useCallback(() => {
    // In production, this would come from the intent tracking hook
    return {
      mouseVelocity: 0,
      scrollDepth: Math.min(window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100, 100) || 0,
      timeOnPage: Math.floor((Date.now() - performance.timeOrigin) / 1000),
      ctaHovers: 0,
      pricingViews: 0,
      exitIntent: false,
      inactivityPeriods: 0,
      viewedProducts: [],
      deviceInfo: {
        type: window.innerWidth > 768 ? 'desktop' : 'mobile',
        browser: navigator.userAgent.includes('Chrome') ? 'chrome' : 'other'
      },
      referrer: document.referrer || 'direct'
    };
  }, []);
  
  /**
   * Clean up any active connections
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);
  
  return {
    sendMessage,
    getInitialGreeting,
    isConnected,
    error,
    cleanup,
    context: contextRef.current
  };
};