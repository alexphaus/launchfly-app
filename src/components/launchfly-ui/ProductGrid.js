'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProductGrid({ 
  title = "Our Products",
  subtitle = "Choose from our range of offerings",
  products = []
}) {
  const params = useParams();
  const router = useRouter();
  
  // Debug logging
  console.log('ProductGrid - params:', params);
  console.log('ProductGrid - window.location:', typeof window !== 'undefined' ? window.location.href : 'server');
  
  // Generate product URLs
  const getProductUrl = (product, index) => {
    const slug = product.id || product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `product-${index}`;
    const productUrl = `/sites/${params?.subdomain || 'demo'}/product/${slug}`;
    console.log('ProductGrid - Generated URL:', productUrl);
    return productUrl;
  };

  // Handle click with navigation
  const handleProductClick = (e, product, index) => {
    e.preventDefault();
    const url = getProductUrl(product, index);
    console.log('ProductGrid - Navigating to:', url);
    router.push(url);
  };

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-white" id="products">
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
            <div
              key={product.id || index}
              onClick={(e) => handleProductClick(e, product, index)}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 cursor-pointer"
            >
              {/* Product Image Placeholder */}
              <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-6 overflow-hidden">
                <div className="flex items-center justify-center">
                  <div className="text-4xl opacity-60">📦</div>
                </div>
              </div>

              {/* Product Info */}
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold group-hover:text-blue-600 transition-colors" style={{ color: 'var(--text-dark, #1f2937)' }}>
                    {product.name}
                  </h3>
                  <span className="text-2xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
                    {product.price}
                  </span>
                </div>

                <p className="text-gray-600 line-clamp-2">
                  {product.description}
                </p>

                {/* Features Preview */}
                {product.features && product.features.length > 0 && (
                  <div className="space-y-1">
                    {product.features.slice(0, 2).map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: 'var(--primary, #3b82f6)' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </div>
                    ))}
                    {product.features.length > 2 && (
                      <div className="text-sm text-gray-500">
                        +{product.features.length - 2} more features
                      </div>
                    )}
                  </div>
                )}

                {/* CTA */}
                <div className="pt-2">
                  <div
                    className="inline-flex items-center text-sm font-semibold group-hover:translate-x-1 transition-transform"
                    style={{ color: 'var(--primary, #3b82f6)' }}
                  >
                    {product.ctaText || 'View Details'}
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Popular Badge */}
              {product.popular && (
                <div 
                  className="absolute -top-3 -right-3 px-3 py-1 rounded-full text-white text-xs font-bold shadow-lg"
                  style={{ background: 'var(--primary, #3b82f6)' }}
                >
                  Popular
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
