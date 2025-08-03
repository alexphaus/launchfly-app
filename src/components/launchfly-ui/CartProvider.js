'use client';

import { createContext, useContext, useReducer, useEffect } from 'react';

const CartContext = createContext();

// Cart actions
const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  APPLY_COUPON: 'APPLY_COUPON',
  REMOVE_COUPON: 'REMOVE_COUPON',
  LOAD_CART: 'LOAD_CART'
};

// Cart reducer
function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + (action.payload.quantity || 1) }
              : item
          )
        };
      }
      
      return {
        ...state,
        items: [...state.items, { ...action.payload, quantity: action.payload.quantity || 1 }]
      };
    }
    
    case CART_ACTIONS.REMOVE_ITEM:
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
    
    case CART_ACTIONS.UPDATE_QUANTITY:
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item
        ).filter(item => item.quantity > 0)
      };
    
    case CART_ACTIONS.CLEAR_CART:
      return {
        ...state,
        items: []
      };
    
    case CART_ACTIONS.APPLY_COUPON:
      return {
        ...state,
        coupon: action.payload
      };
    
    case CART_ACTIONS.REMOVE_COUPON:
      return {
        ...state,
        coupon: null
      };
    
    case CART_ACTIONS.LOAD_CART:
      return action.payload;
    
    default:
      return state;
  }
}

// Initial cart state
const initialCartState = {
  items: [],
  coupon: null
};

// E-commerce settings (these would typically come from business data)
const defaultEcommerceSettings = {
  shipping: {
    freeShippingThreshold: 50,
    standardRate: 5.99,
    expressRate: 12.99
  },
  tax: {
    rate: 0.08, // 8%
    included: false
  },
  policies: {
    returns: "30-day returns",
    shipping: "Ships within 2 business days"
  },
  coupons: {
    // Sample coupons - in real app these would come from backend
    'WELCOME10': { discount: 0.10, description: '10% off your order' },
    'SAVE20': { discount: 0.20, description: '20% off your order' },
    'FREESHIP': { freeShipping: true, description: 'Free shipping' }
  }
};

export function CartProvider({ children, ecommerceSettings = defaultEcommerceSettings }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCartState);
  
  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('launchfly-cart');
      if (savedCart) {
        try {
          dispatch({ type: CART_ACTIONS.LOAD_CART, payload: JSON.parse(savedCart) });
        } catch (error) {
          console.error('Error loading cart from localStorage:', error);
        }
      }
    }
  }, []);
  
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('launchfly-cart', JSON.stringify(cart));
    }
  }, [cart]);

  // Cart actions
  const addItem = (product, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: { ...product, quantity }
    });
  };

  const removeItem = (productId) => {
    dispatch({
      type: CART_ACTIONS.REMOVE_ITEM,
      payload: productId
    });
  };

  const updateQuantity = (productId, quantity) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_QUANTITY,
      payload: { id: productId, quantity }
    });
  };

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
  };

  const applyCoupon = async (couponCode) => {
    const coupon = ecommerceSettings.coupons[couponCode];
    if (coupon) {
      dispatch({
        type: CART_ACTIONS.APPLY_COUPON,
        payload: { code: couponCode, ...coupon }
      });
      return { success: true };
    }
    return { error: 'Invalid coupon code' };
  };

  const removeCoupon = () => {
    dispatch({ type: CART_ACTIONS.REMOVE_COUPON });
  };

  // Cart calculations
  const getSubtotal = () => {
    return cart.items.reduce((total, item) => {
      const price = parseFloat(item.price.replace('$', ''));
      return total + (price * item.quantity);
    }, 0);
  };

  const getItemCount = () => {
    return cart.items.reduce((total, item) => total + item.quantity, 0);
  };

  const getShippingCost = (subtotal = getSubtotal()) => {
    if (cart.coupon?.freeShipping) return 0;
    if (subtotal >= ecommerceSettings.shipping.freeShippingThreshold) return 0;
    return ecommerceSettings.shipping.standardRate;
  };

  const getDiscount = (subtotal = getSubtotal()) => {
    if (!cart.coupon?.discount) return 0;
    return subtotal * cart.coupon.discount;
  };

  const getTax = (taxableAmount) => {
    return taxableAmount * ecommerceSettings.tax.rate;
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const discount = getDiscount(subtotal);
    const taxableAmount = subtotal - discount;
    const shipping = getShippingCost(subtotal);
    const tax = getTax(taxableAmount);
    
    return taxableAmount + shipping + tax;
  };

  const value = {
    // State
    cart,
    ecommerceSettings,
    
    // Actions
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    applyCoupon,
    removeCoupon,
    
    // Calculations
    getSubtotal,
    getItemCount,
    getShippingCost,
    getDiscount,
    getTax,
    getTotal,
    
    // Computed values
    subtotal: getSubtotal(),
    itemCount: getItemCount(),
    shippingCost: getShippingCost(),
    discount: getDiscount(),
    tax: getTax(getSubtotal() - getDiscount()),
    total: getTotal()
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

export default CartProvider;
