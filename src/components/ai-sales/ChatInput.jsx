/**
 * @fileoverview Chat input component with accessibility and animations
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, Smile } from 'lucide-react';
import debounce from 'lodash.debounce';

/**
 * Chat input component
 * @param {Object} props - Component props
 * @param {Function} props.onSendMessage - Callback when message is sent
 * @param {boolean} props.disabled - Whether input is disabled
 * @returns {JSX.Element}
 */
const ChatInput = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const formRef = useRef(null);
  
  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  const inputVariants = {
    focused: {
      scale: 1.02,
      transition: { duration: 0.2 }
    },
    unfocused: {
      scale: 1,
      transition: { duration: 0.2 }
    }
  };
  
  return (
    <motion.form
      ref={formRef}
      onSubmit={handleSubmit}
      variants={inputVariants}
      animate={isFocused ? 'focused' : 'unfocused'}
      className="p-4 bg-white border-t border-gray-200"
    >
      <div className="flex items-end space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder="Type your message..."
            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            rows={1}
            aria-label="Message input"
            style={{ minHeight: '44px' }}
          />
          
          {/* Character counter for long messages */}
          {message.length > 200 && (
            <span className="absolute bottom-2 right-12 text-xs text-gray-400">
              {message.length}/500
            </span>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          {/* Future: Attachment button */}
          {false && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </motion.button>
          )}
          
          {/* Send Button */}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!message.trim() || disabled}
            className={`p-2.5 rounded-lg transition-all ${
              message.trim() && !disabled
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
      
      {/* Quick Actions (Future Enhancement) */}
      {false && (
        <div className="mt-2 flex flex-wrap gap-2">
          {['Tell me more', 'Show pricing', 'Book a demo'].map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => {
                setMessage(quick);
                inputRef.current?.focus();
              }}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
            >
              {quick}
            </button>
          ))}
        </div>
      )}
    </motion.form>
  );
};

export default ChatInput;