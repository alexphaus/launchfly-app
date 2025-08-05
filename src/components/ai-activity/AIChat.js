// src/components/ai-activity/AIChat.js
import { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  SparklesIcon,
  UserIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

export default function AIChat({ businessId, businessData, onNewActivity }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      text: `Hi! I'm your AI assistant working on ${businessData?.business_name || 'your business'}. How can I help you today?`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputValue);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        text: aiResponse,
        timestamp: new Date()
      }]);
      setIsLoading(false);
      
      // Trigger activity refresh if command was executed
      if (inputValue.toLowerCase().includes('start') || 
          inputValue.toLowerCase().includes('stop') ||
          inputValue.toLowerCase().includes('optimize')) {
        onNewActivity();
      }
    }, 1500);
  };

  const generateAIResponse = (input) => {
    const lowerInput = input.toLowerCase();
    
    // Command responses
    if (lowerInput.includes('stop')) {
      return "I've paused all outreach campaigns. Your existing prospects and scheduled emails will remain intact. You can restart anytime by saying 'start campaigns'.";
    }
    
    if (lowerInput.includes('start')) {
      return "Great! I'm resuming customer acquisition activities. I'll start searching for new prospects and sending personalized outreach emails. You should see new activities appearing shortly.";
    }
    
    if (lowerInput.includes('status') || lowerInput.includes('how are we doing')) {
      return `Here's your current status:\n• Prospects found: ${Math.floor(Math.random() * 50) + 100}\n• Emails sent: ${Math.floor(Math.random() * 30) + 50}\n• Response rate: ${Math.floor(Math.random() * 15) + 10}%\n• Meetings booked: ${Math.floor(Math.random() * 5) + 2}\n\nI'm continuously optimizing our approach based on the responses we're getting.`;
    }
    
    if (lowerInput.includes('optimize') || lowerInput.includes('improve')) {
      return "I'm analyzing our campaign performance and making adjustments:\n• Updating email subject lines for better open rates\n• Refining prospect targeting criteria\n• A/B testing different messaging approaches\n\nI'll implement these optimizations over the next few hours.";
    }
    
    if (lowerInput.includes('focus on') || lowerInput.includes('target')) {
      return "Understood! I'll adjust our targeting parameters to focus on those criteria. This will be reflected in our next batch of prospect searches. The changes will take effect within the next hour.";
    }
    
    // General responses
    const generalResponses = [
      "I'm actively working on finding and reaching out to potential customers for your business. Is there anything specific you'd like me to focus on?",
      "I understand your concern. Let me check on that for you and optimize our approach accordingly.",
      "That's a great suggestion! I'll incorporate that into our customer acquisition strategy.",
      "I'm monitoring all our campaigns closely. Would you like me to adjust any specific parameters?"
    ];
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedCommands = [
    "Show me our status",
    "Focus on enterprise clients",
    "Optimize email campaigns",
    "Pause all outreach"
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center">
          <SparklesIcon className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">AI Assistant</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Chat with your AI to control campaigns
        </p>
      </div>

      {/* Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 ${message.type === 'user' ? 'ml-2' : 'mr-2'}`}>
                {message.type === 'ai' ? (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <SparklesIcon className="h-5 w-5 text-blue-600" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-gray-600" />
                  </div>
                )}
              </div>
              
              <div className={`${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
              } rounded-lg px-4 py-2`}>
                <p className="text-sm whitespace-pre-line">{message.text}</p>
                <p className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Commands */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-2">
          {suggestedCommands.map((command, index) => (
            <button
              key={index}
              onClick={() => setInputValue(command)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors"
            >
              {command}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-end space-x-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question or give a command..."
            rows="1"
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              inputValue.trim() && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-xs text-gray-500 mt-2">
          <ExclamationCircleIcon className="inline h-3 w-3 mr-1" />
          AI responses are simulated. Real integration coming soon.
        </p>
      </div>
    </div>
  );
}