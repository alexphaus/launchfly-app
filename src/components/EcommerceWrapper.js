'use client';

import { CartProvider } from '@/hooks/useCart';

export default function EcommerceWrapper({ children, businessData }) {
  const isEcommerce = businessData?.ecommerceSettings?.enabled;

  if (isEcommerce) {
    return (
      <CartProvider>
        {children}
      </CartProvider>
    );
  }

  return children;
}
