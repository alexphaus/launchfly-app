/**
 * @fileoverview Individual chat message component with animations
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { format } from 'date-fns';
import PaymentEmbed from './PaymentEmbed';

/**
 * @typedef {import('../../types/ai-sales').Message} Message
 */

/**
 * Chat message component
 * @param {Object} props - Component props
 * @param {Message} props.message - Message data
 * @returns {JSX.Element}
 */
const ChatMessage = ({ message }) => {
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';
  
  const messageVariants = {
    hidden: {
      opacity: 0,
      x: isAssistant ? -20 : 20,
      y: 10
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  };
  
  if (isSystem) {
    return (
      <motion.div
        variants={messageVariants}
        initial="hidden"
        animate="visible"
        className="text-center py-2"
      >
        <span className="text-xs text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} items-start space-x-2`}
    >
      {isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-blue-600" />
        </div>
      )}
      
      <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} max-w-[80%]`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isAssistant
              ? 'bg-white text-gray-800 shadow-sm'
              : 'bg-blue-600 text-white'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          
          {/* Payment UI */}
          {message.metadata?.isPaymentRequest && message.metadata?.paymentData && (
            <PaymentEmbed
              paymentData={message.metadata.paymentData}
              onSuccess={(paymentResult) => {
                console.log('Payment successful:', paymentResult);
                // In production, this would update the conversation
              }}
              onError={(error) => {
                console.error('Payment failed:', error);
                // In production, this would show error message
              }}
              onCancel={() => {
                console.log('Payment cancelled');
                // In production, this would continue conversation
              }}
            />
          )}
          
          {/* Simple payment button fallback */}
          {message.metadata?.isPaymentRequest && !message.metadata?.paymentData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <p className="text-xs text-gray-600 mb-2">Ready to checkout?</p>
              <button className="w-full bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                Complete Purchase
              </button>
            </motion.div>
          )}
        </div>
        
        <span className="text-xs text-gray-400 mt-1 px-1">
          {format(message.timestamp, 'h:mm a')}
        </span>
      </div>
      
      {!isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-gray-600" />
        </div>
      )}
    </motion.div>
  );
};

export default ChatMessage;