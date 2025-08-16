// src/components/launchfly-ui/ShoppingCart.js
'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';

export default function ShoppingCart({ onClose, isOpen }) {
  // Safe cart access with error handling
  let cart = [], updateQuantity = () => {}, removeFromCart = () => {}, getCartTotal = () => '0.00', getCartCount = () => 0;
  
  try {
    const cartContext = useCart();
    cart = cartContext.cart;
    updateQuantity = cartContext.updateQuantity;
    removeFromCart = cartContext.removeFromCart;
    getCartTotal = cartContext.getCartTotal;
    getCartCount = cartContext.getCartCount;
  } catch (error) {
    console.warn('Cart context not available:', error);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Cart Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 px-4 py-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Shopping Cart</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {cart.length === 0 ? (
              <div className="text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="mt-4">Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-6">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    {/* Product Image */}
                    <div className="h-16 w-16 flex-shrink-0 rounded-md bg-gray-100 flex items-center justify-center">
                      <span className="text-2xl">{item.image || '📦'}</span>
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-500">{item.price}</p>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center mt-2">
                        <button
                          onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="mx-2 text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-400 hover:text-red-500"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-6">
              <div className="flex justify-between text-base font-medium text-gray-900 mb-4">
                <p>Subtotal</p>
                <p>${getCartTotal()}</p>
              </div>
              <button
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                onClick={() => {
                  // Handle checkout
                  window.location.href = '/checkout';
                }}
              >
                Checkout
              </button>
              <p className="mt-2 text-center text-sm text-gray-500">
                Shipping and taxes calculated at checkout.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
