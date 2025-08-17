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
      const { data, error } = await supabase
        .from('fulfillment_content')
        .select(`
          *,
          sales:sale_id (
            customer_name,
            customer_email,
            amount,
            product_id,
            businesses:business_id (
              name,
              business_data
            )
          )
        `)
        .eq('id', params.contentId)
        .single();
        
      if (error) throw error;
      
      if (!data) {
        setError('Content not found');
        return;
      }
      
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
  
  const business = content.sales.businesses;
  const estimatedValue = content.metadata?.estimated_value || '$100+';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{content.title}</h1>
              <p className="text-gray-600 mt-1">
                From {business.name} • Value: {estimatedValue}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                ✅ Delivered
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Accessed {content.access_count || 0} times
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          
          {/* Welcome Message */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
            <div className="flex items-center">
              <div className="text-4xl mr-4">🎉</div>
              <div>
                <h2 className="text-xl font-bold">Welcome, {content.sales.customer_name}!</h2>
                <p className="opacity-90">
                  Your personalized content is ready. This was created specifically for you based on your purchase.
                </p>
              </div>
            </div>
          </div>
          
          {/* Content Body */}
          <div className="p-8">
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: content.content }}
            />
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
