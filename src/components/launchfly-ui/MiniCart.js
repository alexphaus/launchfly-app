'use client';

import { useState, useRef, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';
import { useParams, useRouter } from 'next/navigation';

export default function MiniCart({ className = '' }) {
  const { items, itemCount, subtotal, removeFromCart, updateQuantity } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const cartRef = useRef(null);
  const params = useParams();
  const router = useRouter();

  // Close cart when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (cartRef.current && !cartRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Animation for adding items
  useEffect(() => {
    if (itemCount > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [itemCount]);

  const handleViewCart = () => {
    setIsOpen(false);
    router.push(`/${params.subdomain}/cart`);
  };

  const handleCheckout = () => {
    setIsOpen(false);
    router.push(`/${params.subdomain}/checkout`);
  };

  const formatPrice = (price) => {
    const numPrice = parseFloat(price.toString().replace(/[^0-9.-]+/g, ''));
    return `$${numPrice.toFixed(2)}`;
  };

  return (
    <div className={`relative ${className}`} ref={cartRef}>
      {/* Cart Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full hover:bg-gray-100 transition-all duration-200 ${
          isAnimating ? 'animate-bounce' : ''
        }`}
        aria-label="Shopping cart"
      >
        {/* Cart Icon */}
        <svg
          className="w-6 h-6 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9m-9 0h9"
          />
        </svg>

        {/* Item Count Badge */}
        {itemCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-white text-xs flex items-center justify-center font-bold animate-pulse"
            style={{ background: 'var(--primary, #3b82f6)' }}
          >
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>

      {/* Cart Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          {items.length === 0 ? (
            // Empty Cart
            <div className="p-6 text-center">
              <div className="text-4xl mb-2">🛒</div>
              <p className="text-gray-500 mb-2">Your cart is empty</p>
              <p className="text-sm text-gray-400">Add some products to get started!</p>
            </div>
          ) : (
            <>
              {/* Cart Header */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  Shopping Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </h3>
              </div>

              {/* Cart Items */}
              <div className="max-h-60 overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={`${item.id}-${JSON.stringify(item.variant)}`}
                    className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      {/* Product Image */}
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">📦</span>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {item.name}
                        </h4>
                        {item.variant && (
                          <p className="text-xs text-gray-500 mt-1">
                            {item.variant.name}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-2">
                            {/* Quantity Controls */}
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-sm"
                            >
                              −
                            </button>
                            <span className="text-sm font-medium w-8 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-sm"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatPrice(item.price)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeFromCart(item.id, item.variant)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        aria-label="Remove item"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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

              {/* Cart Footer */}
              <div className="p-4 border-t border-gray-200">
                {/* Subtotal */}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={handleCheckout}
                    className="w-full py-2 px-4 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--primary, #3b82f6)' }}
                  >
                    Checkout
                  </button>
                  <button
                    onClick={handleViewCart}
                    className="w-full py-2 px-4 rounded-lg font-medium border-2 hover:bg-gray-50 transition-colors"
                    style={{ 
                      borderColor: 'var(--primary, #3b82f6)',
                      color: 'var(--primary, #3b82f6)'
                    }}
                  >
                    View Cart
                  </button>
                </div>

                {/* Free Shipping Notice */}
                {subtotal < 50 && (
                  <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 text-center">
                      Add ${(50 - subtotal).toFixed(2)} more for free shipping!
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
