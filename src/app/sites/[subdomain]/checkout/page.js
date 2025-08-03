'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CartProvider, useCart, CheckoutPage } from '@/components/launchfly-ui';

// Checkout page wrapper that handles order placement
function CheckoutPageWithData() {
  const cart = useCart();
  const params = useParams();
  const router = useRouter();
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

  const handlePlaceOrder = async (orderData) => {
    try {
      // Create Stripe checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: businessData.id,
          subdomain: params.subdomain,
          customerEmail: orderData.customer.email,
          customerName: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
          items: orderData.items,
          totals: orderData.totals,
          shippingAddress: orderData.customer
        }),
      });

      const { sessionId, error } = await response.json();

      if (error) {
        throw new Error(error);
      }

      // Load Stripe and redirect to checkout
      const stripe = await import('@stripe/stripe-js').then(module => 
        module.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      );

      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw stripeError;
      }

    } catch (error) {
      console.error('Order placement failed:', error);
      alert('There was an error processing your order. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading checkout...</p>
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

  const shippingOptions = [
    { 
      id: 'standard', 
      name: 'Standard Shipping', 
      price: ecommerceSettings.shipping.standardRate, 
      time: '5-7 business days' 
    },
    { 
      id: 'express', 
      name: 'Express Shipping', 
      price: ecommerceSettings.shipping.expressRate, 
      time: '2-3 business days' 
    }
  ];

  return (
    <CheckoutPage
      cartItems={cart.cart.items}
      businessData={businessData?.business_data || {}}
      onPlaceOrder={handlePlaceOrder}
      couponDiscount={cart.cart.coupon?.discount || 0}
      taxRate={ecommerceSettings.tax.rate}
      shippingOptions={shippingOptions}
      freeShippingThreshold={ecommerceSettings.shipping.freeShippingThreshold}
    />
  );
}

export default function Checkout() {
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
      <CheckoutPageWithData />
    </CartProvider>
  );
}
