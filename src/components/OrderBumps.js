// Order Bumps & Upsells System
// Expected Revenue Impact: +20-30% average order value

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function OrderBumps({ businessId, cart, onAddToCart, className = "" }) {
  const [orderBumps, setOrderBumps] = useState([]);
  const [selectedBumps, setSelectedBumps] = useState(new Set());
  const supabase = createClientComponentClient();

  useEffect(() => {
    generateOrderBumps();
  }, [cart, businessId]);

  async function generateOrderBumps() {
    try {
      // Get business data to understand the industry
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data, name')
        .eq('id', businessId)
        .single();

      if (!business) return;

      const businessData = business.business_data;
      const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price.replace(/[^0-9.-]+/g, '')) * item.quantity), 0);

      // Generate contextual order bumps based on cart items and business type
      const bumps = generateContextualBumps(businessData, cart, cartTotal, business.name);
      setOrderBumps(bumps);
    } catch (error) {
      console.error('Error generating order bumps:', error);
    }
  }

  function generateContextualBumps(businessData, cart, cartTotal, businessName) {
    const isEcommerce = businessData?.isEcommerce;
    const industry = businessData?.industry || '';
    const bumps = [];

    // Complementary product bumps based on industry
    if (isEcommerce) {
      if (industry.toLowerCase().includes('skincare') || industry.toLowerCase().includes('beauty')) {
        bumps.push({
          id: 'skincare-bundle',
          name: 'Essential Skincare Guide',
          description: 'Personalized routine + ingredient analysis',
          price: 19.99,
          originalPrice: 39.99,
          discount: 50,
          image: '📖',
          value: '$127 value for just $19.99',
          urgency: 'Limited time - 50% off'
        });
        
        bumps.push({
          id: 'consultation',
          name: '1-on-1 Skincare Consultation',
          description: '30-min video call with skincare expert',
          price: 47.00,
          originalPrice: 97.00,
          discount: 50,
          image: '👩‍⚕️',
          value: 'Normally $97 - Save $50 today',
          urgency: 'Only 3 spots left today'
        });
      }
      
      if (industry.toLowerCase().includes('fitness') || industry.toLowerCase().includes('health')) {
        bumps.push({
          id: 'meal-plan',
          name: 'Custom Meal Plan',
          description: '30-day personalized nutrition guide',
          price: 27.00,
          originalPrice: 67.00,
          discount: 60,
          image: '🥗',
          value: '$67 value - 60% off today only',
          urgency: 'Add now and save $40'
        });
      }
      
      if (industry.toLowerCase().includes('tech') || industry.toLowerCase().includes('software')) {
        bumps.push({
          id: 'premium-support',
          name: 'Priority Support Package',
          description: '90 days of priority email & chat support',
          price: 29.00,
          originalPrice: 97.00,
          discount: 70,
          image: '🛟',
          value: 'Skip the line - $97 value',
          urgency: '70% off for early customers'
        });
      }
    }

    // Universal bumps that work for any business
    bumps.push({
      id: 'instant-access',
      name: 'Instant Access Upgrade',
      description: 'Get your order delivered instantly via email',
      price: 9.99,
      originalPrice: 19.99,
      discount: 50,
      image: '⚡',
      value: 'No waiting - instant delivery',
      urgency: 'Add for just $9.99'
    });

    // Price-based bumps
    if (cartTotal >= 50) {
      bumps.push({
        id: 'vip-package',
        name: 'VIP Customer Package',
        description: 'Exclusive bonuses + future discounts',
        price: 17.00,
        originalPrice: 47.00,
        discount: 64,
        image: '👑',
        value: 'VIP status + exclusive perks',
        urgency: 'Unlock VIP benefits - 64% off'
      });
    }

    // Limit to 2-3 most relevant bumps
    return bumps.slice(0, 3);
  }

  function toggleOrderBump(bumpId) {
    const newSelected = new Set(selectedBumps);
    if (newSelected.has(bumpId)) {
      newSelected.delete(bumpId);
    } else {
      newSelected.add(bumpId);
    }
    setSelectedBumps(newSelected);

    // Add/remove from cart
    const bump = orderBumps.find(b => b.id === bumpId);
    if (newSelected.has(bumpId)) {
      onAddToCart({
        id: `bump-${bumpId}`,
        name: bump.name,
        price: `$${bump.price}`,
        quantity: 1,
        description: bump.description,
        image: bump.image,
        isOrderBump: true
      });
    } else {
      // Remove from cart (you'll need to implement this)
      // onRemoveFromCart(`bump-${bumpId}`);
    }
  }

  function calculateSavings() {
    return Array.from(selectedBumps).reduce((total, bumpId) => {
      const bump = orderBumps.find(b => b.id === bumpId);
      return total + (bump.originalPrice - bump.price);
    }, 0);
  }

  if (orderBumps.length === 0) return null;

  return (
    <div className={`bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-6 ${className}`}>
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-orange-900 mb-2">
          🎯 Perfect Add-Ons For Your Order
        </h3>
        <p className="text-orange-700">
          These exclusive offers are only available right now
        </p>
        {selectedBumps.size > 0 && (
          <div className="mt-2 bg-green-100 text-green-800 px-4 py-2 rounded-full inline-block">
            💰 You're saving ${calculateSavings().toFixed(2)} today!
          </div>
        )}
      </div>

      <div className="space-y-4">
        {orderBumps.map((bump) => (
          <div
            key={bump.id}
            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedBumps.has(bump.id)
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-orange-300'
            }`}
            onClick={() => toggleOrderBump(bump.id)}
          >
            {/* Discount Badge */}
            <div className="absolute -top-2 -right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              {bump.discount}% OFF
            </div>

            <div className="flex items-center">
              {/* Checkbox */}
              <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center ${
                selectedBumps.has(bump.id)
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300'
              }`}>
                {selectedBumps.has(bump.id) && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Product Image */}
              <div className="text-3xl mr-4">{bump.image}</div>

              {/* Product Details */}
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1">{bump.name}</h4>
                <p className="text-gray-600 text-sm mb-2">{bump.description}</p>
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-green-600">${bump.price}</span>
                  <span className="text-sm text-gray-500 line-through">${bump.originalPrice}</span>
                  <span className="text-sm text-orange-600 font-medium">{bump.value}</span>
                </div>
                <p className="text-sm text-red-600 font-medium mt-1">{bump.urgency}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedBumps.size > 0 && (
        <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-medium text-green-800">
              ✅ {selectedBumps.size} add-on{selectedBumps.size > 1 ? 's' : ''} selected
            </span>
            <span className="font-bold text-green-800">
              Total savings: ${calculateSavings().toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PostPurchaseUpsell({ businessId, customerEmail, orderTotal, onUpsellAccepted }) {
  const [upsellOffer, setUpsellOffer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateUpsellOffer();
  }, [businessId, orderTotal]);

  function generateUpsellOffer() {
    // Generate a relevant upsell based on the purchase
    const offers = [
      {
        id: 'advanced-package',
        name: 'Advanced Success Package',
        description: 'Take your results to the next level with our premium package',
        price: Math.round(orderTotal * 0.6), // 60% of original order
        originalPrice: Math.round(orderTotal * 1.2), // 120% of original order
        features: [
          '3 months of premium support',
          'Advanced training materials',
          'Direct access to experts',
          'Exclusive community membership'
        ],
        image: '🚀',
        urgency: 'Limited time - 50% off for new customers',
        cta: 'Upgrade My Order'
      }
    ];

    setUpsellOffer(offers[0]);
  }

  async function handleUpsellAccept() {
    setLoading(true);
    try {
      // Process the upsell (create new order, charge customer, etc.)
      await onUpsellAccepted(upsellOffer);
    } catch (error) {
      console.error('Error processing upsell:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!upsellOffer) return null;

  return (
    <div className="max-w-2xl mx-auto bg-white border-2 border-blue-200 rounded-xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">{upsellOffer.image}</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Wait! Special Upgrade Available
        </h2>
        <p className="text-gray-600">
          Complete your success journey with this exclusive offer
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold text-blue-900 mb-2">{upsellOffer.name}</h3>
        <p className="text-blue-700 mb-4">{upsellOffer.description}</p>
        
        <ul className="space-y-2 mb-4">
          {upsellOffer.features.map((feature, index) => (
            <li key={index} className="flex items-center text-blue-800">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-green-600">${upsellOffer.price}</span>
            <span className="text-lg text-gray-500 line-through ml-2">${upsellOffer.originalPrice}</span>
            <div className="text-sm text-red-600 font-medium">{upsellOffer.urgency}</div>
          </div>
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleUpsellAccept}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
        >
          {loading ? 'Processing...' : upsellOffer.cta}
        </button>
        <button
          onClick={() => setUpsellOffer(null)}
          className="px-6 py-4 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-all"
        >
          No Thanks
        </button>
      </div>

      <div className="text-center mt-4 text-sm text-gray-500">
        🔒 Secure checkout • 💳 Same payment method • ⚡ Instant access
      </div>
    </div>
  );
}
