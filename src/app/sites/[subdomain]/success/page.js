'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import OrderConfirmation from '@/components/launchfly-ui/OrderConfirmation';

export default function Success() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [businessData, setBusiness] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadBusinessAndOrder();
  }, []);

  async function loadBusinessAndOrder() {
    try {
      const subdomain = await params.subdomain;
      const sessionId = searchParams.get('session_id');
      const orderId = searchParams.get('order_id');

      // Load business data
      const { data: business, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('status', 'ready')
        .single();

      if (error || !business) {
        console.error('Business not found:', error);
        setLoading(false);
        return;
      }

      setBusiness(business);
      
      // Apply theme styles
      const businessContent = business.business_data;
      if (businessContent?.theme?.colors) {
        const root = document.documentElement;
        Object.entries(businessContent.theme.colors).forEach(([key, value]) => {
          root.style.setProperty(`--${key}`, value);
        });
      }

      // Create mock order data (in a real app, you'd fetch this from your database)
      if (sessionId || orderId) {
        const mockOrderData = {
          id: orderId || `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          customer: {
            email: 'customer@example.com',
            firstName: 'John',
            lastName: 'Doe'
          },
          items: [],
          totals: {
            subtotal: 0,
            shipping: 0,
            tax: 0,
            total: 0
          },
          estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        setOrderData(mockOrderData);
      }
      
      // Clear cart from localStorage
      localStorage.removeItem('launchfly-cart');
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading business and order:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!businessData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Business Not Found</h1>
            <p className="text-gray-600">The business you're looking for could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  return <OrderConfirmation orderData={orderData} />;
}
