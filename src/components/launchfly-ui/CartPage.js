'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { useParams, useRouter } from 'next/navigation';

export default function CartPage() {
  const { 
    items, 
    subtotal, 
    coupon, 
    couponDiscount, 
    shippingRate, 
    tax, 
    total,
    updateQuantity, 
    removeFromCart, 
    clearCart,
    applyCoupon,
    removeCoupon
  } = useCart();
  
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const params = useParams();
  const router = useRouter();

  const formatPrice = (price) => {
    const numPrice = parseFloat(price.toString().replace(/[^0-9.-]+/g, ''));
    return `$${numPrice.toFixed(2)}`;
  };

  const handleQuantityChange = (item, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(item.id, item.variant);
    } else {
      updateQuantity(item.id, newQuantity, item.variant);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setCouponLoading(true);
    setCouponError('');
    
    try {
      // Simulate coupon validation - in real app, this would be an API call
      const validCoupons = {
        'SAVE10': { code: 'SAVE10', discount: 0.1, description: '10% off' },
        'WELCOME': { code: 'WELCOME', discount: 0.15, description: '15% off first order' },
        'FREESHIP': { code: 'FREESHIP', discount: 0, freeShipping: true, description: 'Free shipping' }
      };

      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay

      const validCoupon = validCoupons[couponCode.toUpperCase()];
      if (validCoupon) {
        applyCoupon(validCoupon);
        setCouponCode('');
      } else {
        setCouponError('Invalid coupon code');
      }
    } catch (error) {
      setCouponError('Error applying coupon');
    }
    
    setCouponLoading(false);
  };

  const handleContinueShopping = () => {
    router.push(`/${params.subdomain}`);
  };

  const handleCheckout = () => {
    router.push(`/${params.subdomain}/checkout`);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-6xl mb-6">🛒</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-8">
              Looks like you haven't added any items to your cart yet.
            </p>
            <button
              onClick={handleContinueShopping}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: 'var(--primary, #3b82f6)' }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-600 mt-2">
            {items.length} {items.length === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Clear Cart Button */}
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Cart Items</h2>
                <button
                  onClick={clearCart}
                  className="text-sm text-red-600 hover:text-red-500 transition-colors"
                >
                  Clear Cart
                </button>
              </div>

              {/* Items List */}
              <div className="divide-y divide-gray-200">
                {items.map((item) => (
                  <div
                    key={`${item.id}-${JSON.stringify(item.variant)}`}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start space-x-4">
                      {/* Product Image */}
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.name}
                        </h3>
                        {item.variant && (
                          <p className="text-sm text-gray-500 mt-1">
                            {item.variant.name}
                          </p>
                        )}
                        <p className="text-lg font-medium text-gray-900 mt-2">
                          {formatPrice(item.price)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleQuantityChange(item, item.quantity - 1)}
                          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 1)}
                          className="w-16 text-center border border-gray-300 rounded-md py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleQuantityChange(item, item.quantity + 1)}
                          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Item Total */}
                      <div className="text-right min-w-0">
                        <p className="text-lg font-medium text-gray-900">
                          {formatPrice(parseFloat(item.price.toString().replace(/[^0-9.-]+/g, '')) * item.quantity)}
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeFromCart(item.id, item.variant)}
                        className="text-red-400 hover:text-red-500 transition-colors p-1"
                        aria-label="Remove item"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Continue Shopping */}
            <div className="mt-6">
              <button
                onClick={handleContinueShopping}
                className="text-blue-600 hover:text-blue-500 transition-colors font-medium"
              >
                ← Continue Shopping
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-4 mt-8 lg:mt-0">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>

              {/* Coupon Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coupon Code
                </label>
                {coupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                    <div>
                      <span className="text-sm font-medium text-green-800">
                        {coupon.code}
                      </span>
                      <p className="text-xs text-green-600">{coupon.description}</p>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-green-600 hover:text-green-500"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {couponLoading ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p className="text-red-600 text-xs mt-1">{couponError}</p>
                )}
              </div>

              {/* Summary */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm font-medium">${subtotal.toFixed(2)}</span>
                </div>
                
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="text-sm">Discount ({coupon.code})</span>
                    <span className="text-sm font-medium">-${couponDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Shipping</span>
                  <span className="text-sm font-medium">
                    {shippingRate === 0 ? 'Free' : `$${shippingRate.toFixed(2)}`}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tax</span>
                  <span className="text-sm font-medium">${tax.toFixed(2)}</span>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-base font-medium text-gray-900">Total</span>
                    <span className="text-xl font-bold text-gray-900">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white hover:opacity-90 transition-opacity"
                style={{ background: 'var(--primary, #3b82f6)' }}
              >
                Proceed to Checkout
              </button>

              {/* Trust Signals */}
              <div className="mt-6 space-y-2 text-center">
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Secure checkout
                </div>
                <p className="text-xs text-gray-500">30-day returns • Ships within 2 business days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
