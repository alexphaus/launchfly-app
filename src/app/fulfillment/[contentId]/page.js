// src/app/fulfillment/[contentId]/page.js
/**
 * Fulfillment Content Viewer
 * 
 * This page displays the AI-generated content that customers receive
 * after making a purchase. It's where the real value is delivered.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Component to format the content properly
function FormattedContent({ content }) {
  // Process the content to make it readable
  const formatContent = (text) => {
    if (!text) return '';
    
    // Split content into sections and format
    const lines = text.split('\n');
    const formattedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        formattedLines.push('<div class="h-4"></div>'); // Spacing
        continue;
      }
      
      // Headers (### or **)
      if (line.startsWith('### ')) {
        formattedLines.push(`<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4 border-b-2 border-green-200 pb-2">${line.substring(4)}</h3>`);
      }
      // Subheaders (- ** or numbered items)
      else if (line.match(/^\d+\.\s+\*\*/) || line.startsWith('- **')) {
        const cleanLine = line.replace(/^\d+\.\s+\*\*/, '').replace(/^- \*\*/, '').replace(/\*\*/g, '');
        formattedLines.push(`<h4 class="text-lg font-semibold text-gray-800 mt-6 mb-3 flex items-center"><span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm mr-3">📋</span>${cleanLine}</h4>`);
      }
      // Bold text
      else if (line.includes('**')) {
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
        formattedLines.push(`<p class="text-gray-700 mb-3 leading-relaxed">${formatted}</p>`);
      }
      // Bullet points
      else if (line.startsWith('- ')) {
        const bulletContent = line.substring(2);
        formattedLines.push(`<div class="flex items-start mb-2"><span class="text-green-500 mr-3 mt-1">•</span><p class="text-gray-700 leading-relaxed">${bulletContent}</p></div>`);
      }
      // Numbered lists
      else if (line.match(/^\d+\.\s+/)) {
        const number = line.match(/^(\d+)\./)[1];
        const content = line.replace(/^\d+\.\s+/, '');
        formattedLines.push(`<div class="flex items-start mb-3"><span class="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">${number}</span><p class="text-gray-700 leading-relaxed">${content}</p></div>`);
      }
      // Horizontal rules
      else if (line.startsWith('---')) {
        formattedLines.push('<hr class="my-8 border-gray-200">');
      }
      // Regular paragraphs
      else {
        formattedLines.push(`<p class="text-gray-700 mb-4 leading-relaxed">${line}</p>`);
      }
    }
    
    return formattedLines.join('');
  };
  
  return (
    <div className="max-w-none">
      <div dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
      
      {/* Action Section */}
      <div className="mt-12 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900 mb-2">🚀 Ready to Take Action?</h3>
          <p className="text-gray-600 mb-4">
            This content was personalized specifically for you. Start implementing these recommendations today!
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
              Download PDF
            </button>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Schedule Follow-up
            </button>
            <button className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              Share Feedback
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FulfillmentContentPage() {
  const params = useParams();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    loadContent();
  }, []);
  
  async function loadContent() {
    try {
      console.log('Loading content for ID:', params.contentId);
      
      const { data, error } = await supabase
        .from('fulfillment_content')
        .select(`
          *,
          sales!sale_id (
            customer_name,
            customer_email,
            amount,
            product_id,
            businesses!business_id (
              name,
              business_data
            )
          )
        `)
        .eq('id', params.contentId)
        .single();
        
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      if (!data) {
        console.error('No data found for content ID:', params.contentId);
        setError('Content not found');
        return;
      }
      
      console.log('Content loaded successfully:', data);
      setContent(data);
      
      // Track access
      await supabase
        .from('fulfillment_content')
        .update({
          access_count: (data.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', params.contentId);
        
    } catch (err) {
      console.error('Error loading content:', err);
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your content...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😓</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Content Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a 
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }
  
  // Safely access nested data with fallbacks
  const business = content.sales?.businesses || { name: 'Launchfly Business' };
  const customerName = content.sales?.customer_name || 'Valued Customer';
  const estimatedValue = content.metadata?.estimated_value || '$100+';
  
  // Debug mode - remove this in production
  const isDebugMode = process.env.NODE_ENV === 'development';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Debug Panel - Development Only */}
      {isDebugMode && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Debug Info:</strong> Customer: {customerName} | Business: {business.name} | Value: {estimatedValue}
              </p>
              <details className="text-xs text-yellow-600 mt-2">
                <summary>Raw Data Structure</summary>
                <pre className="mt-2 text-xs">{JSON.stringify(content, null, 2)}</pre>
              </details>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">📊</span>
                <h1 className="text-2xl font-bold text-gray-900">{content.title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center text-gray-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  From {business.name}
                </span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                  💰 Value: {estimatedValue}
                </span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                  ✅ Delivered
                </span>
              </div>
            </div>
            <div className="text-right ml-4">
              <div className="text-sm text-gray-500">
                <div>Accessed {content.access_count || 0} times</div>
                <div className="text-xs mt-1">
                  Created {new Date(content.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          
          {/* Welcome Message */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-5xl mr-6">🎉</div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome, {customerName}!</h2>
                  <p className="opacity-90 text-lg">
                    Your personalized content is ready. This was created specifically for you based on your purchase.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                  <div className="text-sm opacity-90 mb-1">Estimated Value</div>
                  <div className="text-2xl font-bold">{estimatedValue}</div>
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">📈</div>
                  <div className="text-sm opacity-90 mt-1">Actionable</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">🎯</div>
                  <div className="text-sm opacity-90 mt-1">Personalized</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">⚡</div>
                  <div className="text-sm opacity-90 mt-1">Immediate</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content Body */}
          <div className="p-8">
            <FormattedContent content={content.content} />
          </div>
          
          {/* Action Section */}
          <div className="bg-gray-50 p-6 border-t">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">💡 Need Help?</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Have questions about implementing this content? We're here to help!
                </p>
                <a 
                  href={`mailto:support@launchfly.ai?subject=Question about ${content.title}&body=Hi, I have a question about my content...`}
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Ask a Question
                </a>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">⭐ Feedback</h3>
                <p className="text-gray-600 text-sm mb-3">
                  How valuable is this content? Your feedback helps us improve.
                </p>
                <button 
                  onClick={() => window.open(`mailto:feedback@launchfly.ai?subject=Feedback for ${content.title}&body=Rating (1-5): \n\nWhat I loved:\n\nWhat could be better:\n\n`)}
                  className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Share Feedback
                </button>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-100 p-4 text-center">
            <p className="text-xs text-gray-500">
              Content delivered by {business.name} • Powered by Launchfly AI
              <br />
              Created on {new Date(content.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
