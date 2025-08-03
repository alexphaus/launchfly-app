'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../hooks/useCart';

export default function EnhancedProductCard({ 
  product,
  featured = false,
  showVariants = true,
  showAddToCart = true
}) {
  const params = useParams();
  const { addToCart } = useCart();
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0] || null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  if (!product) return null;

  const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
  const productUrl = `/${params.subdomain}/product/${productId}`;

  // Determine stock status
  const stockStatus = product.stock > 0 
    ? product.stock < 5 
      ? 'low-stock' 
      : 'in-stock'
    : 'out-of-stock';

  const stockDisplay = {
    'in-stock': 'In Stock',
    'low-stock': `Only ${product.stock} left`,
    'out-of-stock': 'Out of Stock'
  };

  const stockColor = {
    'in-stock': '#10b981',
    'low-stock': '#f59e0b',
    'out-of-stock': '#ef4444'
  };

  // Handle price display with sale prices
  const hasDiscount = product.originalPrice && product.price !== product.originalPrice;
  const displayPrice = selectedVariant?.price || product.price;
  const originalPrice = selectedVariant?.originalPrice || product.originalPrice;

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (stockStatus === 'out-of-stock') return;
    
    setAddingToCart(true);
    
    try {
      await addToCart({
        id: productId,
        name: product.name,
        price: displayPrice,
        image: product.image,
        variant: selectedVariant,
        stock: product.stock
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
    
    setAddingToCart(false);
  };

  return (
    <div 
      className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 relative group ${
        featured ? 'ring-2 transform scale-105' : 'hover:-translate-y-1'
      } ${stockStatus === 'out-of-stock' ? 'opacity-75' : ''}`}
      style={{ 
        ringColor: featured ? 'var(--primary, #3b82f6)' : 'transparent'
      }}
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
      {hasDiscount && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
          SALE
        </div>
      )}

      {/* Product Image */}
      <div className="text-center mb-6 relative overflow-hidden rounded-lg">
        {product.image ? (
          <div className="relative group">
            <img
              src={product.image}
              alt={product.name}
              className={`w-full h-48 object-cover transition-all duration-300 group-hover:scale-110 ${
                !imageLoaded ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setImageLoaded(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                <div className="text-4xl">
                  {product.icon || '📦'}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-6xl bg-gray-50 rounded-lg">
            {product.icon || '📦'}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
          {product.name}
        </h3>
        <p className="text-gray-600 mb-4 text-sm line-clamp-2">{product.description}</p>
        
        {/* Price */}
        <div className="flex items-baseline justify-center mb-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
            {displayPrice}
          </span>
          {hasDiscount && (
            <span className="text-lg text-gray-500 line-through ml-2">
              {originalPrice}
            </span>
          )}
          {product.period && (
            <span className="text-gray-600 ml-1">/{product.period}</span>
          )}
        </div>

        {/* Stock Status */}
        <div className="mb-4">
          <span 
            className="text-sm font-medium"
            style={{ color: stockColor[stockStatus] }}
          >
            {stockDisplay[stockStatus]}
          </span>
        </div>
      </div>

      {/* Variants */}
      {showVariants && product.variants && product.variants.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {product.variantType || 'Options'}:
          </label>
          <select
            value={selectedVariant?.id || ''}
            onChange={(e) => {
              const variant = product.variants.find(v => v.id === e.target.value);
              setSelectedVariant(variant);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
            style={{ 
              '--tw-ring-color': 'var(--primary, #3b82f6)',
              borderColor: 'var(--primary, #3b82f6)'
            }}
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} {variant.price && `- ${variant.price}`}
              </option>
            ))}
          </select>
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
          {product.features.length > 3 && (
            <li className="text-xs text-gray-500 ml-6">
              +{product.features.length - 3} more features
            </li>
          )}
        </ul>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {showAddToCart && (
          <button
            onClick={handleAddToCart}
            disabled={stockStatus === 'out-of-stock' || addingToCart}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
              stockStatus === 'out-of-stock'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'hover:scale-105 shadow-lg text-white'
            }`}
            style={{
              background: stockStatus === 'out-of-stock' 
                ? '#d1d5db' 
                : 'var(--primary, #3b82f6)',
              opacity: addingToCart ? 0.7 : 1
            }}
          >
            {addingToCart ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Adding...
              </div>
            ) : stockStatus === 'out-of-stock' ? (
              'Out of Stock'
            ) : (
              'Add to Cart'
            )}
          </button>
        )}

        {/* View Details Link */}
        <Link
          href={productUrl}
          className={`w-full py-3 px-6 rounded-lg font-semibold transition-all hover:scale-105 block text-center border-2`}
          style={{
            borderColor: 'var(--primary, #3b82f6)',
            color: 'var(--primary, #3b82f6)',
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'var(--primary, #3b82f6)';
            e.target.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = 'var(--primary, #3b82f6)';
          }}
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
