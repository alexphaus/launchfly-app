'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function ProductCard({ 
  product,
  featured = false,
  onAddToCart,
  showAddToCart = false
}) {
  const params = useParams();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  if (!product) return null;

  const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
  const productUrl = `/${params.subdomain}/product/${productId}`;
  
  // Parse prices for sale display (handle both string and number formats)
  const formatPrice = (price) => {
    if (typeof price === 'number') return `$${price.toFixed(2)}`;
    if (typeof price === 'string' && price.startsWith('$')) return price;
    if (typeof price === 'string') return `$${price}`;
    return price;
  };

  const originalPrice = product.originalPrice || product.wasPrice;
  const currentPrice = product.price;
  const isOnSale = originalPrice && originalPrice !== currentPrice && product.isOnSale !== false;
  
  // Stock status (only show for e-commerce products)
  const hasStock = typeof product.stock === 'number';
  const stock = product.stock || 0;
  const inStock = product.inStock !== false && (!hasStock || stock > 0);
  const stockStatus = hasStock ? 
    (stock > 10 ? 'In Stock' : stock > 0 ? `Only ${stock} left` : 'Out of Stock') : 
    (inStock ? 'Available' : 'Unavailable');
  const stockColor = hasStock ? 
    (stock > 10 ? 'text-green-600' : stock > 0 ? 'text-orange-600' : 'text-red-600') :
    (inStock ? 'text-green-600' : 'text-red-600');

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart && inStock) {
      onAddToCart(product);
    }
  };

  return (
    <div 
      className={`bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 relative group ${
        featured ? 'ring-2 transform scale-105' : 'hover:-translate-y-1'
      }`}
      style={{ 
        ringColor: featured ? 'var(--primary, #3b82f6)' : 'transparent'
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Featured Badge */}
      {featured && (
        <div 
          className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-sm font-bold z-10"
          style={{ background: 'var(--primary, #3b82f6)' }}
        >
          Most Popular
        </div>
      )}

      {/* Sale Badge */}
      {isOnSale && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
          SALE
        </div>
      )}

      {/* Product Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className={`w-full h-full object-cover transition-all duration-500 ${
              isHovering ? 'scale-110' : 'scale-100'
            } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {product.icon || '📦'}
          </div>
        )}
        
        {/* Quick Add to Cart Overlay */}
        {showAddToCart && inStock && (
          <div className={`absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-opacity duration-300 ${
            isHovering ? 'opacity-100' : 'opacity-0'
          }`}>
            <button
              onClick={handleAddToCart}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Quick Add
            </button>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
          {product.name}
        </h3>
        <p className="text-gray-600 mb-4 text-sm line-clamp-2">{product.description}</p>
        
        {/* Price */}
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex items-baseline">
            {isOnSale && (
              <span className="text-gray-400 line-through text-lg mr-2">
                {formatPrice(originalPrice)}
              </span>
            )}
            <span className="text-2xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
              {formatPrice(currentPrice)}
            </span>
            {product.period && (
              <span className="text-gray-600 ml-1">/{product.period}</span>
            )}
            {product.deliveryTime && (
              <span className="text-gray-500 text-sm ml-2">({product.deliveryTime})</span>
            )}
          </div>
        </div>

        {/* Stock Status */}
        <div className={`text-sm font-medium mb-4 ${stockColor}`}>
          {stockStatus}
        </div>

        {/* Variants */}
        {product.variants && product.variants.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
              Available Options:
            </div>
            <div className="flex flex-wrap gap-1">
              {product.variants.slice(0, 3).map((variant, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                >
                  {variant}
                </span>
              ))}
              {product.variants.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  +{product.variants.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

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
          </ul>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {showAddToCart && stock > 0 ? (
            <div className="flex gap-2">
              <button
                onClick={handleAddToCart}
                className="flex-1 py-2 px-4 rounded-lg font-semibold transition-all text-white"
                style={{ background: 'var(--primary, #3b82f6)' }}
              >
                Add to Cart
              </button>
              <Link
                href={productUrl}
                className="px-3 py-2 border-2 rounded-lg font-semibold transition-all hover:bg-gray-50"
                style={{ 
                  borderColor: 'var(--primary, #3b82f6)',
                  color: 'var(--primary, #3b82f6)',
                  textDecoration: 'none'
                }}
              >
                View
              </Link>
            </div>
          ) : (
            <Link
              href={productUrl}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-all hover:scale-105 block text-center ${
                featured 
                  ? 'text-white shadow-lg' 
                  : 'border-2 hover:text-white'
              } ${stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: featured ? 'var(--primary, #3b82f6)' : 'transparent',
                borderColor: 'var(--primary, #3b82f6)',
                color: featured ? 'white' : 'var(--primary, #3b82f6)',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                if (!featured && stock > 0) {
                  e.target.style.background = 'var(--primary, #3b82f6)';
                  e.target.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!featured && stock > 0) {
                  e.target.style.background = 'transparent';
                  e.target.style.color = 'var(--primary, #3b82f6)';
                }
              }}
            >
              {stock === 0 ? 'Out of Stock' : (product.ctaText || 'View Details')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}