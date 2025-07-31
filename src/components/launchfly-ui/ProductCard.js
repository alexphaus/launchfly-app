'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ProductCard({ 
  product,
  featured = false 
}) {
  const params = useParams();
  
  if (!product) return null;

  const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
  const productUrl = `/${params.subdomain}/product/${productId}`;

  return (
    <div 
      className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 relative ${
        featured ? 'ring-2 transform scale-105' : 'hover:-translate-y-1'
      }`}
      style={{ 
        ringColor: featured ? 'var(--primary, #3b82f6)' : 'transparent'
      }}
    >
      {/* Featured Badge */}
      {featured && (
        <div 
          className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-sm font-bold"
          style={{ background: 'var(--primary, #3b82f6)' }}
        >
          Most Popular
        </div>
      )}

      {/* Product Icon/Image */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">
          {product.icon || '📦'}
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
          {product.name}
        </h3>
        <p className="text-gray-600 mb-4 text-sm">{product.description}</p>
        
        {/* Price */}
        <div className="flex items-baseline justify-center mb-4">
          <span className="text-3xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
            {product.price}
          </span>
          {product.period && (
            <span className="text-gray-600 ml-1">/{product.period}</span>
          )}
        </div>
      </div>

      {/* Key Features */}
      {product.features && product.features.length > 0 && (
        <ul className="space-y-2 mb-6">
          {product.features.slice(0, 3).map((feature, index) => (
            <li key={index} className="flex items-center text-sm">
              <svg className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: 'var(--primary, #3b82f6)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span style={{ color: 'var(--text-gray, #6b7280)' }}>{feature}</span>
            </li>
          ))}
          {product.features.length > 3 && (
            <li className="text-xs text-gray-500 ml-6">
              +{product.features.length - 3} more features
            </li>
          )}
        </ul>
      )}

      {/* CTA Button */}
      <Link
        href={productUrl}
        className={`w-full py-3 px-6 rounded-lg font-semibold transition-all hover:scale-105 block text-center ${
          featured 
            ? 'text-white shadow-lg' 
            : 'border-2 hover:text-white'
        }`}
        style={{
          background: featured ? 'var(--primary, #3b82f6)' : 'transparent',
          borderColor: 'var(--primary, #3b82f6)',
          color: featured ? 'white' : 'var(--primary, #3b82f6)',
          textDecoration: 'none'
        }}
        onMouseEnter={(e) => {
          if (!featured) {
            e.target.style.background = 'var(--primary, #3b82f6)';
            e.target.style.color = 'white';
          }
        }}
        onMouseLeave={(e) => {
          if (!featured) {
            e.target.style.background = 'transparent';
            e.target.style.color = 'var(--primary, #3b82f6)';
          }
        }}
      >
        {product.ctaText || 'View Details'}
      </Link>
    </div>
  );
}
