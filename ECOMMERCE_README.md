# Launchfly E-commerce Template

A complete, minimal e-commerce solution integrated into the Launchfly platform. This template provides all essential e-commerce features with elegant simplicity and flawless user experience.

## 🚀 Features

### Core Components
- **EnhancedProductCard**: Product display with cart integration, stock status, and variant selection
- **MiniCart**: Shopping cart dropdown with item management and quick checkout
- **CartPage**: Full cart management with coupon codes and order summary
- **CheckoutPage**: Single-page checkout with Stripe integration
- **OrderConfirmation**: Post-purchase confirmation with order details

### Key Capabilities
- ✅ Product browsing and quick add to cart
- ✅ Persistent cart state (localStorage)
- ✅ Quantity management and item removal
- ✅ Coupon code support
- ✅ Tax and shipping calculations
- ✅ Stripe payment processing
- ✅ Order confirmation and tracking
- ✅ Responsive design for all devices
- ✅ Business-specific branding and theming

## 🛠 Architecture

### State Management
- **CartProvider**: React Context API for global cart state
- **localStorage**: Persistent cart data across sessions
- **Reducer Pattern**: Clean state updates with cartReducer

### Integration Points
- **Business Data**: Automatic e-commerce settings generation
- **Supabase**: Database integration for business and product data
- **Stripe**: Secure payment processing
- **Next.js**: Server-side rendering and API routes

## 📁 File Structure

```
src/
├── components/
│   └── launchfly-ui/
│       ├── ProductCard.js        # Enhanced product display
│       ├── MiniCart.js          # Cart dropdown
│       ├── CartPage.js          # Full cart page
│       ├── CheckoutPage.js      # Checkout flow
│       ├── OrderConfirmation.js # Order success page
│       ├── CartProvider.js      # Cart state management
│       └── NavBar.js           # Updated with cart integration
└── app/
    ├── cart/
    │   └── page.js              # Cart route
    ├── checkout/
    │   └── page.js              # Checkout route
    └── sites/[subdomain]/
        └── product/[productId]/
            └── page.js          # Product detail with cart
```

## 🎯 Usage

### 1. Cart Provider Setup
The CartProvider is automatically included in the site layout and provides cart functionality to all components.

### 2. Adding Products to Cart
```javascript
// In any component
const { addToCart } = useCart();

const handleAddToCart = () => {
  addToCart({
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image,
    // ... other product data
  });
};
```

### 3. Cart Navigation
- **MiniCart**: Accessible from navigation bar hover/click
- **Cart Page**: Full cart management at `/cart`
- **Checkout**: Secure checkout flow at `/checkout`

### 4. Business Configuration
E-commerce settings are automatically generated for each business:

```javascript
// Generated in core/launch.js
ecommerceSettings: {
  shipping: {
    standard: { name: 'Standard Shipping', price: 5.99, estimatedDays: '5-7' },
    express: { name: 'Express Shipping', price: 12.99, estimatedDays: '2-3' },
    overnight: { name: 'Overnight Shipping', price: 24.99, estimatedDays: '1' }
  },
  tax: {
    rate: 0.08,
    includedInPrice: false
  },
  currency: 'USD',
  policies: {
    returns: '30-day return policy',
    privacy: 'We protect your privacy and never share your data.',
    terms: 'Standard terms and conditions apply.'
  }
}
```

## 🎨 Customization

### Theming
All components use CSS custom properties that automatically adapt to business branding:
- `--primary-color`
- `--secondary-color` 
- `--accent-color`
- `--text-color`
- `--background-color`

### Component Styling
Each component is built with Tailwind CSS and includes:
- Responsive breakpoints
- Hover and focus states
- Loading states
- Error handling
- Accessibility features

## 🔧 API Integration

### Stripe Checkout
```javascript
// Checkout integration
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: cartItems,
    shipping: selectedShipping,
    businessId: business.id
  })
});
```

### Business Data
```javascript
// Supabase integration
const { data: business } = await supabase
  .from('businesses')
  .select('*, ecommerceSettings')
  .eq('subdomain', subdomain)
  .single();
```

## 🚦 Testing Flow

1. **Product Browse**: Visit any generated business site
2. **Add to Cart**: Click "Add to Cart" on product cards
3. **Cart Review**: Hover/click cart icon to view MiniCart
4. **Cart Management**: Navigate to `/cart` for full management
5. **Checkout**: Proceed to `/checkout` for payment
6. **Confirmation**: View order confirmation page

## 🔒 Security Features

- **Stripe Integration**: PCI-compliant payment processing
- **Input Validation**: All forms include validation
- **Error Handling**: Graceful error states and fallbacks
- **Data Protection**: Secure handling of customer information

## 📱 Mobile Optimization

- **Responsive Design**: Optimized for all screen sizes
- **Touch Interactions**: Mobile-friendly touch targets
- **Performance**: Lazy loading and optimized images
- **Accessibility**: WCAG compliance for all users

## 🚀 Performance

- **Code Splitting**: Components loaded on demand
- **State Optimization**: Efficient re-renders with React Context
- **Caching**: localStorage for cart persistence
- **Lazy Loading**: Images and components load as needed

---

*This e-commerce template provides everything needed for a complete online store while maintaining the elegant simplicity that Launchfly is known for.*
