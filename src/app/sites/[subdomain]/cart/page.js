'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CartProvider, useCart, CartPage } from '@/components/launchfly-ui';

// Cart page wrapper that provides business data
function CartPageWithData() {
  const cart = useCart();
  const params = useParams();
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('subdomain', params.subdomain)
          .eq('status', 'ready')
          .single();

        if (error) {
          console.error('Error fetching business:', error);
          return;
        }

        setBusinessData(data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBusiness();
  }, [params.subdomain, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cart...</p>
        </div>
      </div>
    );
  }

  // Get e-commerce settings from business data
  const ecommerceSettings = businessData?.business_data?.ecommerceSettings || {
    shipping: {
      freeShippingThreshold: 50,
      standardRate: 5.99,
      expressRate: 12.99
    },
    tax: {
      rate: 0.08,
      included: false
    },
    policies: {
      returns: "30-day returns",
      shipping: "Ships within 2 business days"
    }
  };

  return (
    <CartPage
      cartItems={cart.cart.items}
      onRemoveItem={cart.removeItem}
      onUpdateQuantity={cart.updateQuantity}
      onApplyCoupon={cart.applyCoupon}
      couponCode={cart.cart.coupon?.code || ''}
      couponDiscount={cart.cart.coupon?.discount || 0}
      shippingRate={ecommerceSettings.shipping.standardRate}
      taxRate={ecommerceSettings.tax.rate}
      freeShippingThreshold={ecommerceSettings.shipping.freeShippingThreshold}
    />
  );
}

export default function Cart() {
  const params = useParams();
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('subdomain', params.subdomain)
          .eq('status', 'ready')
          .single();

        if (!error && data) {
          setBusinessData(data);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBusiness();
  }, [params.subdomain, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const ecommerceSettings = businessData?.business_data?.ecommerceSettings || {
    shipping: { freeShippingThreshold: 50, standardRate: 5.99, expressRate: 12.99 },
    tax: { rate: 0.08, included: false },
    policies: { returns: "30-day returns", shipping: "Ships within 2 business days" },
    coupons: {
      'WELCOME10': { discount: 0.10, description: '10% off your order' },
      'SAVE20': { discount: 0.20, description: '20% off your order' }
    }
  };

  return (
    <CartProvider ecommerceSettings={ecommerceSettings}>
      <CartPageWithData />
    </CartProvider>
  );
}
