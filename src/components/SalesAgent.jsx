'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useConversion } from '../hooks/useConversion';

const SalesAgent = memo(({ product = {}, businessId, subdomain, config = {} }) => {
  // Core state - optimized for conversions
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [stage, setStage] = useState('hook'); // hook → qualify → close → upsell
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [offerCode, setOfferCode] = useState(null);
  const [urgencyTimer, setUrgencyTimer] = useState(null);
  const [socialProof, setSocialProof] = useState(Math.floor(Math.random() * 15) + 5); // 5-20 viewers
  const [hasShownTrigger, setHasShownTrigger] = useState(false);
  const messagesEndRef = useRef(null);
  const { intent, triggers, trackEvent } = useConversion();

  // Visitor intelligence tracking
  const [visitor, setVisitor] = useState({
    intent: 0,
    triggerShown: false,
    messageCount: 0,
    objections: [],
    interested: false,
    email: null
  });

  // Product defaults with psychological pricing
  const productData = {
    name: product.name || 'Premium Solution',
    price: product.price || '$97',
    fakePrice: product.fakePrice || '$497',
    savings: product.savings || '$400',
    benefit: product.benefit || 'transform your business',
    guarantee: '30-day money back',
    scarcity: 'Only 3 left at this price',
    urgency: '10 minute hold',
    bonuses: [
      'Bonus Training ($197 value)',
      'Priority Support ($97/mo value)', 
      'Success Templates ($297 value)'
    ],
    ...product
  };

  // Conversion triggers that actually work
  const conversionTriggers = {
    15000: {
      message: `Hey! I noticed you checking out ${productData.name} 👋`,
      stage: 'hook'
    },
    exitIntent: {
      message: "WAIT! Don't leave empty-handed... 40% OFF if you stay 🎁",
      stage: 'close',
      offer: 'EXIT40'
    },
    scrollPricing: {
      message: `I see you're looking at the price... what if I told you it pays for itself in 7 days? 💰`,
      stage: 'qualify'
    },
    idle30: {
      message: "Still thinking? The last person who hesitated missed out... just saying 🤷",
      stage: 'close'
    }
  };

  // Quick replies that guide to purchase
  const quickReplies = {
    hook: ["Tell me more", "What's the catch?", "How much?"],
    qualify: ["Will this work for me?", "Show me proof", "I'm interested"],
    close: ["Apply discount", "I'm ready", "Still expensive"],
    upsell: ["Add everything", "Just the basics", "I'll pass"]
  };

  // BEHAVIORAL TRIGGERS - The Secret Sauce
  useEffect(() => {
    if (hasShownTrigger || isOpen) return;
    
    const triggerTimers = [];
    
    // 15 second opener
    const timer1 = setTimeout(() => {
      if (!hasShownTrigger && !isOpen) {
        showTriggeredChat(conversionTriggers[15000]);
      }
    }, 15000);
    
    // Exit intent detection
    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 && !hasShownTrigger) {
        showTriggeredChat(conversionTriggers.exitIntent);
        trackEvent('exit_intent', 50);
      }
    };

    // Pricing scroll detection
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent > 60 && !hasShownTrigger) {
        showTriggeredChat(conversionTriggers.scrollPricing);
        trackEvent('pricing_scroll', 30);
      }
    };

    // Idle detection
    let idleTimer;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!hasShownTrigger && !isOpen) {
          showTriggeredChat(conversionTriggers.idle30);
          trackEvent('idle_30s', 40);
        }
      }, 30000);
    };

    // Social proof counter (increases engagement)
    const socialProofTimer = setInterval(() => {
      setSocialProof(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        return Math.max(3, Math.min(25, prev + change));
      });
    }, 8000);

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('scroll', handleScroll);
    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keypress', resetIdleTimer);
    
    triggerTimers.push(timer1, socialProofTimer);
    resetIdleTimer();

    return () => {
      triggerTimers.forEach(timer => clearTimeout(timer));
      clearTimeout(idleTimer);
      clearInterval(socialProofTimer);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', resetIdleTimer);
      document.removeEventListener('keypress', resetIdleTimer);
    };
  }, [hasShownTrigger, isOpen]);

  // Show chat with trigger message
  const showTriggeredChat = useCallback((trigger) => {
    setMessages([{ 
      role: 'assistant', 
      content: trigger.message, 
      timestamp: Date.now(),
      stage: trigger.stage 
    }]);
    setStage(trigger.stage);
    if (trigger.offer) {
      setOfferCode(trigger.offer);
      setUrgencyTimer(600); // 10 minutes
    }
    setIsOpen(true);
    setHasShownTrigger(true);
  }, []);

  // Countdown timer for urgency
  useEffect(() => {
    if (!urgencyTimer) return;
    
    const interval = setInterval(() => {
      setUrgencyTimer(prev => {
        if (prev <= 1) {
          setOfferCode(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [urgencyTimer]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // AI RESPONSE ENGINE - Conversion-focused
  const sendMessage = async (text = input) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    // Update visitor tracking
    setVisitor(prev => ({
      ...prev,
      messageCount: prev.messageCount + 1,
      intent: Math.min(100, prev.intent + 10)
    }));

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          stage,
          product: productData,
          visitor,
          context: {
            socialProof,
            urgencyTimer: formatTime(urgencyTimer),
            offerCode: offerCode || 'CHAT20',
            intent
          }
        })
      });

      const data = await response.json();
      
      // Auto-advance stages based on engagement
      let newStage = stage;
      if (visitor.messageCount >= 1 && stage === 'hook') newStage = 'qualify';
      if (visitor.messageCount >= 3 && stage === 'qualify') newStage = 'close';
      if (data.offer && !offerCode) {
        setOfferCode(data.offer);
        setUrgencyTimer(600); // 10 minutes
      }
      
      setStage(newStage);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        timestamp: Date.now(),
        stage: newStage,
        offer: data.offer
      }]);

    } catch (error) {
      console.error('AI Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm having connection issues. Here's what I can offer: Get 40% off with code SAVE40 - expires in 5 minutes!",
        timestamp: Date.now(),
        offer: 'SAVE40'
      }]);
    }

    setIsTyping(false);
  };

  // ONE-CLICK CHECKOUT - No friction
  const handleCheckout = async () => {
    trackEvent('checkout_attempt', 50);
    localStorage.setItem('conversion_attempt', 'true');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productData.name,
          productPrice: parseFloat(productData.price.replace('$', '')),
          discountCode: offerCode,
          businessId,
          subdomain,
          chatHistory: messages.length
        })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "There was an issue with checkout. Can I get your email to send you a direct payment link?",
        timestamp: Date.now()
      }]);
    }
  };

  const handleQuickReply = (reply) => {
    sendMessage(reply);
  };

  // Format countdown timer
  const formatTime = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuickReplies = () => {
    return quickReplies[stage] || [];
  };

  return (
    <>
      {/* Floating bubble with social proof */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 
                     rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all 
                     duration-300 flex items-center justify-center z-50 animate-bounce"
        >
          <span className="text-2xl">💬</span>
          {messages.length > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full 
                           flex items-center justify-center text-white text-xs font-bold animate-pulse">
              {messages.filter(m => m.role === 'assistant').length}
            </div>
          )}
          {/* Social proof badge */}
          <div className="absolute -top-8 -left-4 bg-black bg-opacity-80 text-white text-xs 
                         px-2 py-1 rounded whitespace-nowrap">
            {socialProof} people viewing
          </div>
        </button>
      )}

      {/* Enhanced chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[550px] bg-white rounded-2xl shadow-2xl 
                       flex flex-col z-50 border border-gray-200 overflow-hidden">
          
          {/* Header with urgency timer */}
          <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  🤖
                </div>
                <div>
                  <h3 className="font-semibold">Sales Expert</h3>
                  <p className="text-xs opacity-90">
                    {socialProof} people viewing • Save {productData.savings}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 w-8 h-8 
                          rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Urgency timer */}
            {urgencyTimer && offerCode && (
              <div className="mt-2 bg-red-500 bg-opacity-90 px-3 py-1 rounded-full text-center">
                <span className="text-sm font-bold">
                  🔥 {offerCode} expires in {formatTime(urgencyTimer)}
                </span>
              </div>
            )}
          </div>

          {/* Messages with enhanced styling */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <div className="text-4xl mb-2">🎯</div>
                <p className="font-semibold">Ready to transform your business?</p>
                <p className="text-sm mt-1">I'll show you exactly how to {productData.benefit}</p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm border'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  
                  {/* Special offer display */}
                  {message.offer && message.role === 'assistant' && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg border-l-4 border-green-500">
                      <div className="text-xs text-gray-600 mb-1">Special Offer</div>
                      <div className="font-bold text-green-700">
                        Code: {message.offer} 
                        <span className="text-sm ml-2">
                          (Was {productData.fakePrice} → Now {productData.price})
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Checkout button for closing stage */}
                  {message.role === 'assistant' && (stage === 'close' || stage === 'upsell') && (
                    <button
                      onClick={handleCheckout}
                      className="mt-3 w-full bg-gradient-to-r from-green-600 to-green-700 text-white 
                               py-3 px-4 rounded-lg text-sm font-bold hover:from-green-700 hover:to-green-800 
                               transition-all transform hover:scale-105 shadow-lg"
                    >
                      🚀 Get {productData.name} - {productData.price}
                      {offerCode && (
                        <div className="text-xs opacity-90 mt-1">
                          Use code {offerCode} • Expires in {formatTime(urgencyTimer)}
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-bl-md shadow-sm border">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Enhanced quick replies */}
          {getQuickReplies().length > 0 && (
            <div className="px-4 pb-2 bg-gray-50">
              <div className="flex flex-wrap gap-2">
                {getQuickReplies().map((reply, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickReply(reply)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 
                             text-white px-4 py-2 rounded-full text-sm font-medium transition-all 
                             transform hover:scale-105 shadow-md"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input with enhanced styling */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                         disabled:from-gray-400 disabled:to-gray-400 text-white w-12 h-12 rounded-full 
                         flex items-center justify-center transition-all transform hover:scale-105 shadow-lg"
              >
                <span className="text-lg">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// Performance optimization
SalesAgent.displayName = 'SalesAgent';

export default SalesAgent;
