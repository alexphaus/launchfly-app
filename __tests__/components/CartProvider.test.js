/**
 * Tests for the Cart Provider and cart functionality
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CartProvider, useCart } from '../../src/components/launchfly-ui/CartProvider'

// Test component that uses cart context
const TestCartComponent = () => {
  const cart = useCart()
  
  const testProduct = {
    id: 'test-1',
    name: 'Test Product',
    price: 99.99,
    image: 'test-image.jpg'
  }

  return (
    <div>
      <div data-testid="cart-count">{cart.totalItems}</div>
      <div data-testid="cart-total">${cart.total.toFixed(2)}</div>
      <div data-testid="subtotal">${cart.subtotal.toFixed(2)}</div>
      <div data-testid="tax">${cart.tax.toFixed(2)}</div>
      <div data-testid="shipping">${cart.shipping.toFixed(2)}</div>
      
      <button 
        data-testid="add-item" 
        onClick={() => cart.addItem(testProduct)}
      >
        Add Item
      </button>
      
      <button 
        data-testid="remove-item" 
        onClick={() => cart.removeItem('test-1')}
      >
        Remove Item
      </button>
      
      <button 
        data-testid="update-quantity" 
        onClick={() => cart.updateQuantity('test-1', 3)}
      >
        Update Quantity
      </button>
      
      <button 
        data-testid="clear-cart" 
        onClick={() => cart.clearCart()}
      >
        Clear Cart
      </button>
      
      <button 
        data-testid="apply-coupon" 
        onClick={() => cart.applyCoupon({ code: 'SAVE10', discount: 0.1 })}
      >
        Apply Coupon
      </button>

      <div data-testid="cart-items">
        {cart.items.map(item => (
          <div key={item.id} data-testid={`item-${item.id}`}>
            {item.name} - Qty: {item.quantity} - ${(item.price * item.quantity).toFixed(2)}
          </div>
        ))}
      </div>
    </div>
  )
}

const defaultSettings = {
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
    returns: '30-day returns',
    shipping: 'Ships within 2 business days'
  },
  coupons: {
    'SAVE10': { discount: 0.1, description: '10% off' },
    'SAVE20': { discount: 0.2, description: '20% off' }
  }
}

describe('CartProvider', () => {
  const renderWithCartProvider = (settings = defaultSettings) => {
    return render(
      <CartProvider ecommerceSettings={settings}>
        <TestCartComponent />
      </CartProvider>
    )
  }

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('Initial state', () => {
    test('should start with empty cart', () => {
      renderWithCartProvider()
      
      expect(screen.getByTestId('cart-count')).toTextContent('0')
      expect(screen.getByTestId('cart-total')).toTextContent('$0.00')
      expect(screen.getByTestId('subtotal')).toTextContent('$0.00')
      expect(screen.getByTestId('tax')).toTextContent('$0.00')
      expect(screen.getByTestId('shipping')).toTextContent('$5.99') // Standard shipping
    })

    test('should load cart from localStorage if available', () => {
      const savedCart = {
        items: [{
          id: 'saved-1',
          name: 'Saved Product',
          price: 50.00,
          quantity: 2
        }],
        coupon: null
      }
      
      localStorage.setItem('launchfly_cart', JSON.stringify(savedCart))
      
      renderWithCartProvider()
      
      expect(screen.getByTestId('cart-count')).toTextContent('2')
      expect(screen.getByTestId('subtotal')).toTextContent('$100.00')
    })
  })

  describe('Adding items', () => {
    test('should add new item to cart', () => {
      renderWithCartProvider()
      
      fireEvent.click(screen.getByTestId('add-item'))
      
      expect(screen.getByTestId('cart-count')).toTextContent('1')
      expect(screen.getByTestId('subtotal')).toTextContent('$99.99')
      expect(screen.getByTestId('item-test-1')).toBeInTheDocument()
    })

    test('should increase quantity when adding existing item', () => {
      renderWithCartProvider()
      
      // Add item twice
      fireEvent.click(screen.getByTestId('add-item'))
      fireEvent.click(screen.getByTestId('add-item'))
      
      expect(screen.getByTestId('cart-count')).toTextContent('2')
      expect(screen.getByTestId('subtotal')).toTextContent('$199.98')
      expect(screen.getByTestId('item-test-1')).toTextContent('Test Product - Qty: 2 - $199.98')
    })
  })

  describe('Removing items', () => {
    test('should remove item from cart', () => {
      renderWithCartProvider()
      
      // Add then remove item
      fireEvent.click(screen.getByTestId('add-item'))
      expect(screen.getByTestId('cart-count')).toTextContent('1')
      
      fireEvent.click(screen.getByTestId('remove-item'))
      expect(screen.getByTestId('cart-count')).toTextContent('0')
      expect(screen.queryByTestId('item-test-1')).not.toBeInTheDocument()
    })
  })

  describe('Updating quantities', () => {
    test('should update item quantity', () => {
      renderWithCartProvider()
      
      // Add item then update quantity
      fireEvent.click(screen.getByTestId('add-item'))
      fireEvent.click(screen.getByTestId('update-quantity'))
      
      expect(screen.getByTestId('cart-count')).toTextContent('3')
      expect(screen.getByTestId('subtotal')).toTextContent('$299.97')
      expect(screen.getByTestId('item-test-1')).toTextContent('Test Product - Qty: 3 - $299.97')
    })

    test('should remove item when quantity is set to 0', () => {
      renderWithCartProvider()
      
      const cart = useCart()
      
      // Add item
      fireEvent.click(screen.getByTestId('add-item'))
      expect(screen.getByTestId('cart-count')).toTextContent('1')
      
      // Update quantity to 0
      act(() => {
        cart.updateQuantity('test-1', 0)
      })
      
      expect(screen.getByTestId('cart-count')).toTextContent('0')
      expect(screen.queryByTestId('item-test-1')).not.toBeInTheDocument()
    })
  })

  describe('Cart totals calculation', () => {
    test('should calculate tax correctly', () => {
      renderWithCartProvider()
      
      fireEvent.click(screen.getByTestId('add-item'))
      
      const subtotal = 99.99
      const expectedTax = subtotal * 0.08 // 8% tax rate
      const expectedTotal = subtotal + expectedTax + 5.99 // + shipping
      
      expect(screen.getByTestId('subtotal')).toTextContent('$99.99')
      expect(screen.getByTestId('tax')).toTextContent(`$${expectedTax.toFixed(2)}`)
      expect(screen.getByTestId('cart-total')).toTextContent(`$${expectedTotal.toFixed(2)}`)
    })

    test('should apply free shipping when threshold is met', () => {
      renderWithCartProvider()
      
      // Add enough items to meet free shipping threshold ($50)
      const expensiveProduct = {
        id: 'expensive-1',
        name: 'Expensive Product',
        price: 75.00,
        image: 'expensive.jpg'
      }
      
      const cart = useCart()
      
      act(() => {
        cart.addItem(expensiveProduct)
      })
      
      expect(screen.getByTestId('shipping')).toTextContent('$0.00')
    })

    test('should calculate totals with coupon applied', () => {
      renderWithCartProvider()
      
      fireEvent.click(screen.getByTestId('add-item'))
      fireEvent.click(screen.getByTestId('apply-coupon'))
      
      const subtotal = 99.99
      const discount = subtotal * 0.1 // 10% discount
      const discountedSubtotal = subtotal - discount
      const tax = discountedSubtotal * 0.08
      const total = discountedSubtotal + tax + 5.99
      
      expect(screen.getByTestId('subtotal')).toTextContent(`$${discountedSubtotal.toFixed(2)}`)
      expect(screen.getByTestId('cart-total')).toTextContent(`$${total.toFixed(2)}`)
    })
  })

  describe('Coupon functionality', () => {
    test('should apply valid coupon', () => {
      renderWithCartProvider()
      
      fireEvent.click(screen.getByTestId('add-item'))
      fireEvent.click(screen.getByTestId('apply-coupon'))
      
      // Should reduce subtotal by 10%
      const originalSubtotal = 99.99
      const discountedSubtotal = originalSubtotal * 0.9
      
      expect(screen.getByTestId('subtotal')).toTextContent(`$${discountedSubtotal.toFixed(2)}`)
    })

    test('should handle invalid coupon code', () => {
      renderWithCartProvider()
      
      const cart = useCart()
      
      fireEvent.click(screen.getByTestId('add-item'))
      
      // Try to apply invalid coupon
      act(() => {
        const result = cart.applyCoupon({ code: 'INVALID', discount: 0.1 })
        expect(result).toBe(false) // Should return false for invalid coupon
      })
      
      // Subtotal should remain unchanged
      expect(screen.getByTestId('subtotal')).toTextContent('$99.99')
    })
  })

  describe('Clear cart', () => {
    test('should clear all items from cart', () => {
      renderWithCartProvider()
      
      // Add multiple items
      fireEvent.click(screen.getByTestId('add-item'))
      fireEvent.click(screen.getByTestId('add-item'))
      
      expect(screen.getByTestId('cart-count')).toTextContent('2')
      
      fireEvent.click(screen.getByTestId('clear-cart'))
      
      expect(screen.getByTestId('cart-count')).toTextContent('0')
      expect(screen.getByTestId('subtotal')).toTextContent('$0.00')
      expect(screen.queryByTestId('item-test-1')).not.toBeInTheDocument()
    })
  })

  describe('LocalStorage persistence', () => {
    test('should save cart to localStorage on changes', () => {
      renderWithCartProvider()
      
      fireEvent.click(screen.getByTestId('add-item'))
      
      const savedCart = JSON.parse(localStorage.getItem('launchfly_cart'))
      expect(savedCart.items).toHaveLength(1)
      expect(savedCart.items[0].name).toBe('Test Product')
      expect(savedCart.items[0].quantity).toBe(1)
    })

    test('should clear localStorage when cart is cleared', () => {
      renderWithCartProvider()
      
      fireEvent.click(screen.getByTestId('add-item'))
      expect(localStorage.getItem('launchfly_cart')).toBeTruthy()
      
      fireEvent.click(screen.getByTestId('clear-cart'))
      expect(localStorage.getItem('launchfly_cart')).toBe('null')
    })
  })

  describe('Different e-commerce settings', () => {
    test('should use custom shipping rates', () => {
      const customSettings = {
        ...defaultSettings,
        shipping: {
          freeShippingThreshold: 100,
          standardRate: 9.99,
          expressRate: 19.99
        }
      }
      
      renderWithCartProvider(customSettings)
      
      expect(screen.getByTestId('shipping')).toTextContent('$9.99')
    })

    test('should use custom tax rate', () => {
      const customSettings = {
        ...defaultSettings,
        tax: {
          rate: 0.10, // 10% tax
          included: false
        }
      }
      
      renderWithCartProvider(customSettings)
      
      fireEvent.click(screen.getByTestId('add-item'))
      
      const expectedTax = 99.99 * 0.10
      expect(screen.getByTestId('tax')).toTextContent(`$${expectedTax.toFixed(2)}`)
    })

    test('should handle tax-included pricing', () => {
      const customSettings = {
        ...defaultSettings,
        tax: {
          rate: 0.08,
          included: true
        }
      }
      
      renderWithCartProvider(customSettings)
      
      fireEvent.click(screen.getByTestId('add-item'))
      
      // Tax should be $0 when included in price
      expect(screen.getByTestId('tax')).toTextContent('$0.00')
    })
  })

  describe('Error handling', () => {
    test('should handle invalid product data gracefully', () => {
      renderWithCartProvider()
      
      const cart = useCart()
      
      // Try to add invalid product
      act(() => {
        cart.addItem(null)
      })
      
      expect(screen.getByTestId('cart-count')).toTextContent('0')
    })

    test('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage full')
      })
      
      renderWithCartProvider()
      
      // Should not crash when localStorage fails
      expect(() => {
        fireEvent.click(screen.getByTestId('add-item'))
      }).not.toThrow()
      
      // Restore localStorage
      localStorage.setItem = originalSetItem
    })
  })
})
