'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CartProvider } from '@/hooks/useCart';
import CartPage from '@/components/launchfly-ui/CartPage';

export default function Cart() {
  const params = useParams();
  const [businessData, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadBusiness();
  }, []);

  async function loadBusiness() {
    try {
      const subdomain = await params.subdomain;

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
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading business:', error);
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

  return (
    <CartProvider>
      <CartPage />
    </CartProvider>
  );
}
