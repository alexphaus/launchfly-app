'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function CartPage({ 
  cartItems = [], 
  onRemoveItem, 
  onUpdateQuantity,
  onApplyCoupon,
  couponCode = '',
  couponDiscount = 0,
  shippingRate = 0,
  taxRate = 0.08,
  freeShippingThreshold = 50
}) {
  const [quantities, setQuantities] = useState({});
  const [couponInput, setCouponInput] = useState(couponCode);
  const [couponError, setCouponError] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [shipping, setShipping] = useState(shippingRate);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);
  const params = useParams();

  // Initialize quantities from cart items
  useEffect(() => {
    const initialQuantities = {};
    cartItems.forEach(item => {
      initialQuantities[item.id] = item.quantity;
    });
    setQuantities(initialQuantities);
  }, [cartItems]);

  // Calculate totals
  useEffect(() => {
    const sub = cartItems.reduce((sum, item) => {
      const price = parseFloat(item.price.replace('$', ''));
      return sum + (price * (quantities[item.id] || item.quantity));
    }, 0);
    
    const finalShipping = sub >= freeShippingThreshold ? 0 : shippingRate;
    const discountAmount = (sub * couponDiscount);
    const taxableAmount = sub - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    const finalTotal = taxableAmount + finalShipping + taxAmount;

    setSubtotal(sub);
    setShipping(finalShipping);
    setTax(taxAmount);
    setTotal(finalTotal);
  }, [cartItems, quantities, couponDiscount, shippingRate, taxRate, freeShippingThreshold]);

  const handleQuantityChange = (itemId, newQuantity) => {
    if (newQuantity === 0) {
      handleRemoveItem(itemId);
    } else {
      setQuantities(prev => ({ ...prev, [itemId]: newQuantity }));
      if (onUpdateQuantity) {
        onUpdateQuantity(itemId, newQuantity);
      }
    }
  };

  const handleRemoveItem = (itemId) => {
    setQuantities(prev => {
      const newQuantities = { ...prev };
      delete newQuantities[itemId];
      return newQuantities;
    });
    if (onRemoveItem) {
      onRemoveItem(itemId);
    }
  };

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (onApplyCoupon) {
      const result = await onApplyCoupon(couponInput);
      if (result.error) {
        setCouponError(result.error);
      }
    }
  };

  const clearCart = () => {
    cartItems.forEach(item => handleRemoveItem(item.id));
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🛒</div>
            <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
              Your cart is empty
            </h1>
            <p className="text-gray-600 mb-8">
              Looks like you haven't added anything to your cart yet.
            </p>
            <Link
              href={`/${params.subdomain}`}
              className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white transition-colors"
              style={{ 
                background: 'var(--primary, #3b82f6)',
                textDecoration: 'none'
              }}
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-dark, #1f2937)' }}>
            Shopping Cart
          </h1>
          <p className="text-gray-600 mt-1">{cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your cart</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Desktop Table Header */}
              <div className="hidden md:block border-b border-gray-200 px-6 py-4">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-2 text-center">Price</div>
                  <div className="col-span-2 text-center">Total</div>
                </div>
              </div>

              {/* Cart Items */}
              <div className="divide-y divide-gray-200">
                {cartItems.map((item, index) => {
                  const quantity = quantities[item.id] || item.quantity;
                  const price = parseFloat(item.price.replace('$', ''));
                  const itemTotal = price * quantity;

                  return (
                    <div key={item.id || index} className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        {/* Product Info */}
                        <div className="md:col-span-6 flex items-center gap-4">
                          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <span className="text-2xl">{item.icon || '📦'}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold" style={{ color: 'var(--text-dark, #1f2937)' }}>
                              {item.name}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                            {item.variant && (
                              <p className="text-sm text-gray-500 mt-1">
                                Variant: {item.variant}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="md:col-span-2 flex items-center justify-center">
                          <div className="flex items-center border border-gray-300 rounded-lg">
                            <button
                              onClick={() => handleQuantityChange(item.id, quantity - 1)}
                              className="p-2 hover:bg-gray-100 transition-colors"
                              disabled={quantity <= 1}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="px-4 py-2 font-medium min-w-[3rem] text-center">
                              {quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.id, quantity + 1)}
                              className="p-2 hover:bg-gray-100 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="md:col-span-2 text-center">
                          <span className="font-medium" style={{ color: 'var(--primary, #3b82f6)' }}>
                            {item.price}
                          </span>
                        </div>

                        {/* Total */}
                        <div className="md:col-span-1 text-center">
                          <span className="font-bold" style={{ color: 'var(--text-dark, #1f2937)' }}>
                            ${itemTotal.toFixed(2)}
                          </span>
                        </div>

                        {/* Remove Button */}
                        <div className="md:col-span-1 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-400 hover:text-red-600 p-2"
                            aria-label="Remove item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cart Actions */}
              <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between">
                <Link
                  href={`/${params.subdomain}`}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  style={{ textDecoration: 'none' }}
                >
                  ← Continue Shopping
                </Link>
                <button
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-6">
              <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-dark, #1f2937)' }}>
                Order Summary
              </h2>

              {/* Coupon Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
                  Coupon Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="px-4 py-2 border-2 rounded-lg font-medium transition-colors"
                    style={{ 
                      borderColor: 'var(--primary, #3b82f6)',
                      color: 'var(--primary, #3b82f6)'
                    }}
                  >
                    Apply
                  </button>
                </div>
                {couponDiscount > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    Coupon applied: {(couponDiscount * 100).toFixed(0)}% off
                  </p>
                )}
                {couponError && (
                  <p className="text-sm text-red-600 mt-1">{couponError}</p>
                )}
              </div>

              {/* Order Details */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-${(subtotal * couponDiscount).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                </div>
                
                {subtotal < freeShippingThreshold && freeShippingThreshold > 0 && (
                  <p className="text-sm text-gray-600">
                    Add ${(freeShippingThreshold - subtotal).toFixed(2)} for free shipping
                  </p>
                )}
                
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                
                <hr />
                
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span style={{ color: 'var(--primary, #3b82f6)' }}>
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <Link
                href={`/${params.subdomain}/checkout`}
                className="w-full py-4 px-6 rounded-lg font-bold text-center text-white text-lg transition-all hover:scale-105 block"
                style={{ 
                  background: 'var(--primary, #3b82f6)',
                  textDecoration: 'none'
                }}
              >
                Checkout
              </Link>

              {/* Trust Indicators */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span>Secure checkout</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>30-day returns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                    </svg>
                    <span>Ships within 2 business days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
