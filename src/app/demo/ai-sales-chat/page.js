/**
 * @fileoverview Demo page for AI Sales Chat widget
 * Shows the chat widget in action with sample interactions
 */

'use client';

import React, { useEffect } from 'react';
import { AISalesChat, IntentIndicator } from '../../../components/ai-sales';
import { useAIChat } from '../../../hooks/useAIChat';
import { useVisitorIntent } from '../../../hooks/useVisitorIntent';

export default function AISalesChatDemo() {
  const {
    isOpen,
    messages,
    toggleChat,
    addAIResponse,
    simulateTyping,
    shouldShowProactiveMessage
  } = useAIChat({
    businessId: 'demo-business',
    onChatOpened: () => {
      console.log('Chat opened');
    },
    onMessageSent: (message) => {
      console.log('Message sent:', message);
      // Simulate AI response
      handleDemoResponse(message.content);
    }
  });
  
  // Initialize visitor intent tracking
  const {
    intentAnalysis,
    intentScore,
    intentStage,
    shouldShowChat,
    getRecommendedOpener
  } = useVisitorIntent({
    businessId: 'demo-business',
    onIntentChange: (analysis, comparison) => {
      console.log('Intent changed:', analysis, comparison);
      
      // Auto-open chat when intent is high enough
      if (analysis.score >= 60 && !isOpen) {
        setTimeout(() => {
          if (!isOpen) { // Check again in case user opened manually
            const opener = getRecommendedOpener();
            if (opener) {
              addAIResponse(opener.message);
              if (!isOpen) toggleChat();
            }
          }
        }, 2000);
      }
    },
    onRecommendation: (recommendations) => {
      console.log('New recommendations:', recommendations);
    }
  });
  
  // Simulate AI responses based on user input
  const handleDemoResponse = async (userMessage) => {
    await simulateTyping(1500, 'Thinking...');
    
    const lowerMessage = userMessage.toLowerCase();
    let response = '';
    
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      response = "Our pricing starts at $99/month for the basic plan. We also offer premium plans with advanced features. Would you like me to show you a detailed comparison?";
    } else if (lowerMessage.includes('demo') || lowerMessage.includes('trial')) {
      response = "I'd be happy to set up a personalized demo for you! We also offer a 14-day free trial. Which would you prefer?";
    } else if (lowerMessage.includes('feature')) {
      response = "Our platform includes AI-powered landing page generation, real-time A/B testing, conversion tracking, and this AI sales assistant. What specific features are you most interested in?";
    } else if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
      response = "I'm here to help! You can ask me about pricing, features, or I can help you get started with a free trial. What would you like to know?";
    } else {
      response = "That's a great question! Let me help you find the perfect solution for your business. Could you tell me more about what you're looking to achieve?";
    }
    
    addAIResponse(response);
  };
  
  // Show proactive message after inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && messages.length === 1 && shouldShowProactiveMessage()) {
        addAIResponse("👋 I see you're checking out our AI-powered solutions. Need any help or have questions about how we can boost your conversions?");
      }
    }, 15000);
    
    return () => clearTimeout(timer);
  }, [isOpen, messages, shouldShowProactiveMessage, addAIResponse]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Demo Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Sales Chat Demo
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Experience our AI-powered sales assistant that engages visitors,
            answers questions, and helps convert them into customers.
          </p>
        </div>
        
        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          <div className="bg-white rounded-xl shadow-lg p-6 product-card" data-track="product">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Instant Engagement</h3>
            <p className="text-gray-600">
              AI detects visitor intent and proactively starts conversations at the perfect moment.
            </p>
            <button className="mt-4 cta-button bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700" data-track="cta">
              Learn More
            </button>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 product-card" data-track="product">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Smart Responses</h3>
            <p className="text-gray-600">
              Powered by GPT-4, providing intelligent, context-aware responses to visitor questions.
            </p>
            <button className="mt-4 cta-button bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700" data-track="cta">
              See Demo
            </button>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 product-card" data-track="product">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Built-in Payments</h3>
            <p className="text-gray-600">
              Close deals instantly with integrated Stripe payment processing right in the chat.
            </p>
            <button className="mt-4 cta-button bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700" data-track="cta">
              Get Started
            </button>
          </div>
        </div>
        
        {/* Pricing Section for Intent Testing */}
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto mb-16 pricing-table" data-track="pricing">
          <h2 className="text-2xl font-semibold text-center mb-6">Simple Pricing</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-6 plan-card" data-track="pricing">
              <h3 className="text-lg font-semibold mb-2">Starter</h3>
              <div className="text-3xl font-bold mb-4 price">$99<span className="text-sm text-gray-500">/month</span></div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ AI Chat Widget</li>
                <li>✓ Basic Analytics</li>
                <li>✓ Email Support</li>
              </ul>
              <button className="w-full cta-button bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700" data-track="cta">
                Choose Plan
              </button>
            </div>
            <div className="border-2 border-blue-600 rounded-lg p-6 plan-card" data-track="pricing">
              <div className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-2">
                POPULAR
              </div>
              <h3 className="text-lg font-semibold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4 price">$299<span className="text-sm text-gray-500">/month</span></div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ Everything in Starter</li>
                <li>✓ Advanced AI Features</li>
                <li>✓ Payment Processing</li>
                <li>✓ Priority Support</li>
              </ul>
              <button className="w-full cta-button bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700" data-track="cta">
                Choose Plan
              </button>
            </div>
            <div className="border rounded-lg p-6 plan-card" data-track="pricing">
              <h3 className="text-lg font-semibold mb-2">Enterprise</h3>
              <div className="text-3xl font-bold mb-4 price">Custom</div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ Everything in Pro</li>
                <li>✓ Custom Integrations</li>
                <li>✓ Dedicated Support</li>
                <li>✓ SLA Guarantee</li>
              </ul>
              <button className="w-full cta-button bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700" data-track="cta">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
        
        {/* Demo Instructions */}
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Try It Out!</h2>
          <div className="space-y-3 text-gray-600">
            <p className="flex items-start">
              <span className="text-blue-600 font-semibold mr-2">1.</span>
              Look for the chat widget in the bottom right corner
            </p>
            <p className="flex items-start">
              <span className="text-blue-600 font-semibold mr-2">2.</span>
              Click to open and start a conversation
            </p>
            <p className="flex items-start">
              <span className="text-blue-600 font-semibold mr-2">3.</span>
              Try asking about pricing, features, or request a demo
            </p>
            <p className="flex items-start">
              <span className="text-blue-600 font-semibold mr-2">4.</span>
              Experience the AI's intelligent responses and see how it guides you toward conversion
            </p>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This is a demo with simulated responses. In production, the AI will have access to your full product catalog, pricing, and can process real payments.
            </p>
          </div>
        </div>
        
        {/* Sample Questions */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Sample Questions to Try:</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "What's your pricing?",
              "Can I see a demo?",
              "What features do you offer?",
              "Do you have a free trial?",
              "How does it work?"
            ].map((question) => (
              <button
                key={question}
                onClick={() => {
                  if (!isOpen) toggleChat();
                  // Note: In a real implementation, this would send the message
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* AI Sales Chat Widget */}
      <AISalesChat
        businessId="demo-business"
        businessData={{
          name: "Launchfly Demo",
          products: [
            { id: 1, name: "Starter Plan", price: 99 },
            { id: 2, name: "Pro Plan", price: 299 },
            { id: 3, name: "Enterprise", price: "Custom" }
          ]
        }}
      />
      
      {/* Intent Indicator for Development */}
      <IntentIndicator
        intentAnalysis={intentAnalysis}
        visible={true}
        position="top-right"
      />
    </div>
  );
}