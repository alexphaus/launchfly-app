'use client';

import { createContext, useContext, useReducer, useEffect } from 'react';

const CartContext = createContext();

// Cart reducer
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(
        item => item.id === action.payload.id && 
        JSON.stringify(item.variant) === JSON.stringify(action.payload.variant)
      );

      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id && 
            JSON.stringify(item.variant) === JSON.stringify(action.payload.variant)
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        };
      } else {
        return {
          ...state,
          items: [...state.items, { ...action.payload, quantity: 1 }]
        };
      }
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(
          item => !(item.id === action.payload.id && 
          JSON.stringify(item.variant) === JSON.stringify(action.payload.variant))
        )
      };

    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id && 
          JSON.stringify(item.variant) === JSON.stringify(action.payload.variant)
            ? { ...item, quantity: action.payload.quantity }
            : item
        ).filter(item => item.quantity > 0)
      };

    case 'CLEAR_CART':
      return {
        ...state,
        items: []
      };

    case 'SET_CART':
      return {
        ...state,
        items: action.payload
      };

    case 'APPLY_COUPON':
      return {
        ...state,
        coupon: action.payload
      };

    case 'REMOVE_COUPON':
      return {
        ...state,
        coupon: null
      };

    default:
      return state;
  }
}

// Initial state
const initialState = {
  items: [],
  coupon: null
};

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('launchfly-cart');
    if (savedCart) {
      try {
        const cartData = JSON.parse(savedCart);
        dispatch({ type: 'SET_CART', payload: cartData.items || [] });
        if (cartData.coupon) {
          dispatch({ type: 'APPLY_COUPON', payload: cartData.coupon });
        }
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('launchfly-cart', JSON.stringify(state));
  }, [state]);

  // Calculate totals
  const subtotal = state.items.reduce((total, item) => {
    const price = parseFloat(item.price.toString().replace(/[^0-9.-]+/g, ''));
    return total + (price * item.quantity);
  }, 0);

  const couponDiscount = state.coupon ? (subtotal * state.coupon.discount) : 0;
  const discountedSubtotal = subtotal - couponDiscount;

  // These would come from ecommerce settings
  const shippingRate = discountedSubtotal >= 50 ? 0 : 5.99;
  const taxRate = 0.08;
  const tax = discountedSubtotal * taxRate;
  const total = discountedSubtotal + shippingRate + tax;

  const itemCount = state.items.reduce((count, item) => count + item.quantity, 0);

  const addToCart = (product) => {
    dispatch({ type: 'ADD_ITEM', payload: product });
  };

  const removeFromCart = (productId, variant = null) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id: productId, variant } });
  };

  const updateQuantity = (productId, quantity, variant = null) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity, variant } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const applyCoupon = (coupon) => {
    dispatch({ type: 'APPLY_COUPON', payload: coupon });
  };

  const removeCoupon = () => {
    dispatch({ type: 'REMOVE_COUPON' });
  };

  const value = {
    items: state.items,
    coupon: state.coupon,
    itemCount,
    subtotal,
    couponDiscount,
    shippingRate,
    tax,
    total,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyCoupon,
    removeCoupon
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
