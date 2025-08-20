// src/hooks/useCart.js
'use client';

import { useState, useEffect, createContext, useContext } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [cartSessionId, setCartSessionId] = useState(null);
  const [customerInfo, setCustomerInfo] = useState({ email: '', name: '' });

  // Generate unique cart session ID
  useEffect(() => {
    let sessionId = localStorage.getItem('cart-session-id');
    if (!sessionId) {
      sessionId = 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('cart-session-id', sessionId);
    }
    setCartSessionId(sessionId);
  }, []);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('shopping-cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
    
    const savedCustomerInfo = localStorage.getItem('customer-info');
    if (savedCustomerInfo) {
      setCustomerInfo(JSON.parse(savedCustomerInfo));
    }
  }, []);

  // Save cart to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('shopping-cart', JSON.stringify(cart));
  }, [cart]);

  // Save customer info to localStorage
  useEffect(() => {
    localStorage.setItem('customer-info', JSON.stringify(customerInfo));
  }, [customerInfo]);

  // Function to manually update cart session (called from checkout page)
  const updateCartSession = async () => {
    if (!cartSessionId) return;
    
    try {
      const currentCart = JSON.parse(localStorage.getItem('shopping-cart') || '[]');
      const currentCustomerInfo = JSON.parse(localStorage.getItem('customer-info') || '{"email":"","name":""}');
      
      const total = currentCart.reduce((sum, item) => {
        const price = parseFloat(item.price.replace(/[^0-9.-]+/g, ''));
        return sum + (price * item.quantity);
      }, 0);

      await fetch('/api/cart-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: cartSessionId,
          customerEmail: currentCustomerInfo.email,
          customerName: currentCustomerInfo.name,
          items: currentCart,
          totalAmount: total
        })
      });
    } catch (error) {
      console.error('Error updating cart session:', error);
    }
  };

  // Set customer info for abandoned cart recovery
  const setCustomerData = (email, name) => {
    setCustomerInfo(prev => {
      // Only update if values actually changed
      if (prev.email !== email || prev.name !== name) {
        return { email, name };
      }
      return prev;
    });
  };

  const addToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = parseFloat(item.price.replace(/[^0-9.-]+/g, ''));
      return total + (price * item.quantity);
    }, 0).toFixed(2);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const clearCart = () => {
    setCart([]);
  };

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    getCartCount,
    clearCart,
    cartSessionId,
    customerInfo,
    setCustomerData,
    updateCartSession
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
