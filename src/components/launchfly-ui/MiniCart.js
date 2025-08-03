'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function MiniCart({ 
  cartItems = [], 
  onRemoveItem, 
  onUpdateQuantity,
  onClose
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [subtotal, setSubtotal] = useState(0);
  const dropdownRef = useRef(null);
  const params = useParams();

  // Calculate subtotal
  useEffect(() => {
    const total = cartItems.reduce((sum, item) => {
      const price = parseFloat(item.price.replace('$', ''));
      return sum + (price * item.quantity);
    }, 0);
    setSubtotal(total);
  }, [cartItems]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleRemoveItem = (itemId) => {
    if (onRemoveItem) {
      onRemoveItem(itemId);
    }
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    if (newQuantity === 0) {
      handleRemoveItem(itemId);
    } else if (onUpdateQuantity) {
      onUpdateQuantity(itemId, newQuantity);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Cart Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Shopping cart"
      >
        <svg
          className="w-6 h-6"
          style={{ color: 'var(--primary, #3b82f6)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6.5-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"
          />
        </svg>
        
        {/* Item Count Badge */}
        {totalItems > 0 && (
          <span 
            className="absolute -top-1 -right-1 text-white text-xs font-bold min-w-[1.25rem] h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--primary, #3b82f6)' }}
          >
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-dark, #1f2937)' }}>
                Shopping Cart
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🛒</div>
                <p className="text-gray-500">Your cart is empty</p>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {cartItems.map((item, index) => (
                    <div key={item.id || index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {/* Item Image/Icon */}
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-xl">{item.icon || '📦'}</span>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate" style={{ color: 'var(--text-dark, #1f2937)' }}>
                          {item.name}
                        </h4>
                        <p className="text-sm" style={{ color: 'var(--primary, #3b82f6)' }}>
                          {item.price}
                        </p>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-sm hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="text-sm font-medium min-w-[1rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-sm hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        aria-label="Remove item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Subtotal */}
                <div className="border-t pt-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium" style={{ color: 'var(--text-dark, #1f2937)' }}>
                      Subtotal:
                    </span>
                    <span className="font-bold text-lg" style={{ color: 'var(--primary, #3b82f6)' }}>
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Taxes and shipping calculated at checkout
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Link
                    href={`/${params.subdomain}/cart`}
                    className="w-full py-2 px-4 border-2 rounded-lg font-semibold text-center hover:bg-gray-50 transition-colors"
                    style={{ 
                      borderColor: 'var(--primary, #3b82f6)',
                      color: 'var(--primary, #3b82f6)',
                      textDecoration: 'none'
                    }}
                    onClick={() => setIsOpen(false)}
                  >
                    View Cart
                  </Link>
                  <Link
                    href={`/${params.subdomain}/checkout`}
                    className="w-full py-2 px-4 rounded-lg font-semibold text-center text-white transition-colors"
                    style={{ background: 'var(--primary, #3b82f6)' }}
                    onClick={() => setIsOpen(false)}
                  >
                    Checkout
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
