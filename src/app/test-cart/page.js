'use client';

import { CartProvider } from '@/hooks/useCart';
import NavBar from '@/components/launchfly-ui/NavBar';

export default function TestCartPage() {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        <NavBar 
          businessName="Test E-commerce Store"
          isEcommerce={true}
          links={['Home', 'Products', 'About', 'Contact']}
        />
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">E-commerce Cart Test</h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Cart Functionality Test</h2>
            <p className="text-gray-600 mb-4">
              This page tests the shopping cart functionality. The NavBar above should show:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>A search icon (🔍)</li>
              <li>A shopping cart icon (🛒)</li>
              <li>No cart count badge (since cart is empty)</li>
              <li>No JavaScript errors in the console</li>
            </ul>
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">
                ✅ If you can see this page without errors, the cart context is working correctly!
              </p>
            </div>
          </div>
        </div>
      </div>
    </CartProvider>
  );
}
