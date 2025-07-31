'use client';

import ProductCard from './ProductCard';

export default function ProductGrid({ 
  title = "Our Products",
  subtitle = "Choose what works best for you",
  products = [],
  businessId,
  businessSubdomain
}) {
  if (!products || products.length === 0) {
    return null; // Don't render anything if no products
  }

  return (
    <section className="py-20 bg-gray-50" id="products">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-gray, #6b7280)' }}>
            {subtitle}
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <ProductCard
              key={product.id || index}
              product={product}
              businessId={businessId}
              businessSubdomain={businessSubdomain}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
