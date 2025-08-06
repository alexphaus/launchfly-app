/**
 * @fileoverview Main AI Sales Chat widget component
 * Responsive chat interface with animations and accessibility
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, MessageCircle, Send } from 'lucide-react';
import useAIChatStore from '../../stores/ai-chat-store';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { nanoid } from 'nanoid';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

/**
 * Main AI Sales Chat widget
 * @param {Object} props - Component props
 * @param {string} props.businessId - Business ID for context
 * @param {Object} props.businessData - Business information
 * @returns {JSX.Element}
 */
const AISalesChat = ({ businessId, businessData }) => {
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  const {
    isOpen,
    isMinimized,
    hasNewMessage,
    messages,
    isTyping,
    typingMessage,
    config,
    toggleChat,
    minimizeChat,
    closeChat,
    addMessage
  } = useAIChatStore();
  
  // Initialize streaming chat
  const { 
    sendMessage, 
    getInitialGreeting, 
    isConnected, 
    error 
  } = useStreamingChat({
    businessId,
    sessionId: `session_${nanoid()}`,
    visitorId: `visitor_${nanoid()}`
  });
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);
  
  // Animation variants
  const chatVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 20,
      transition: {
        duration: 0.2,
        ease: 'easeInOut'
      }
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    minimized: {
      opacity: 0,
      scale: 0,
      transition: {
        duration: 0.2
      }
    }
  };
  
  const buttonVariants = {
    idle: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };
  
  const pulseVariants = {
    pulse: {
      scale: [1, 1.2, 1],
      opacity: [1, 0.7, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };
  
  // Position classes based on config
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4 sm:bottom-6 sm:right-6',
    'bottom-left': 'bottom-4 left-4 sm:bottom-6 sm:left-6'
  };
  
  return (
    <>
      {/* Chat Widget Container */}
      <AnimatePresence mode="wait">
        {isOpen && !isMinimized && (
          <motion.div
            ref={chatContainerRef}
            variants={chatVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={`fixed ${positionClasses[config.position]} z-50 w-full max-w-sm sm:max-w-md`}
            role="dialog"
            aria-label="AI Sales Assistant Chat"
            aria-modal="true"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] max-h-[80vh]">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-700"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Sales Assistant</h3>
                    <p className="text-blue-100 text-xs">Always here to help</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <motion.button
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={minimizeChat}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Minimize chat"
                  >
                    <Minimize2 className="w-4 h-4 text-white" />
                  </motion.button>
                  <motion.button
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={closeChat}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4 text-white" />
                  </motion.button>
                </div>
              </div>
              
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                
                {/* Typing Indicator */}
                <AnimatePresence>
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center space-x-2 text-gray-500"
                    >
                      <div className="flex space-x-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-gray-400 rounded-full"
                            animate={{
                              y: [0, -5, 0],
                              transition: {
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.1
                              }
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-sm italic">{typingMessage || 'Assistant is typing...'}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <ChatInput
                onSendMessage={async (content) => {
                  // Add user message immediately
                  addMessage({
                    role: 'user',
                    content
                  });
                  
                  // Send to AI via streaming
                  try {
                    await sendMessage(content);
                  } catch (error) {
                    console.error('Failed to send message:', error);
                  }
                }}
                disabled={isConnected}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Floating Action Button */}
      <AnimatePresence>
        {(!isOpen || isMinimized) && (
          <motion.button
            variants={chatVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleChat}
            className={`fixed ${positionClasses[config.position]} z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full p-4 shadow-xl hover:shadow-2xl transition-shadow`}
            aria-label="Open chat"
          >
            <div className="relative">
              <MessageCircle className="w-6 h-6" />
              {hasNewMessage && (
                <motion.div
                  variants={pulseVariants}
                  animate="pulse"
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                />
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default AISalesChat;