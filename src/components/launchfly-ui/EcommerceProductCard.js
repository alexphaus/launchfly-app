// src/components/launchfly-ui/EcommerceProductCard.js
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { isValidImageUrl, getProductImageUrl } from '@/lib/image-utils';

export default function EcommerceProductCard({ product }) {
  const [imageError, setImageError] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const { addToCart } = useCart();
  const params = useParams();

  if (!product) return null;

  const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
  const productUrl = `/sites/${params.subdomain}/product/${encodeURIComponent(productId)}`;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    
    // Show a brief success indicator
    const button = e.target;
    const originalText = button.textContent;
    button.textContent = 'Added!';
    button.style.backgroundColor = '#10b981';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.backgroundColor = '';
    }, 1500);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Check if we have a valid image URL
  const productImageUrl = getProductImageUrl(product);
  const hasValidImage = !!productImageUrl && !imageError;

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }

    if (hasHalfStar) {
      stars.push(
        <svg key="half" className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="half-fill">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path fill="url(#half-fill)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }

    // Fill remaining with empty stars
    for (let i = stars.length; i < 5; i++) {
      stars.push(
        <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }

    return stars;
  };

  return (
    <div className="group relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
      {/* Sale Badge */}
      {product.sale && (
        <div className="absolute top-4 left-4 z-10 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
          SALE
        </div>
      )}

      {/* Quick Actions */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowQuickView(true)}
          className="p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
          title="Quick View"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button
          className="p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
          title="Add to Wishlist"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <Link href={productUrl} className="block">
        {/* Product Image */}
        <div className="aspect-square overflow-hidden bg-gray-100 relative">
          {hasValidImage ? (
            <img
              src={productImageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
              onError={handleImageError}
              loading="eager"
              decoding="async"
            />
          ) : (
            /* Fallback for no image or error */
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <span className="text-6xl">
                {product.icon || product.emoji || '📦'}
              </span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-6">
          {/* Category */}
          {product.category && (
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              {product.category}
            </span>
          )}

          {/* Product Name */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
            {product.name}
          </h3>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex">
                {renderStars(product.rating)}
              </div>
              <span className="text-sm text-gray-500">
                ({product.reviewCount || 0})
              </span>
            </div>
          )}

          {/* Description */}
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {product.description}
          </p>

          {/* Price */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-gray-900">
                {product.price}
              </span>
              {product.originalPrice && (
                <span className="text-sm text-gray-500 line-through">
                  {product.originalPrice}
                </span>
              )}
            </div>
            
            {/* Stock Status */}
            {product.inStock !== undefined && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                product.inStock 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {product.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            )}
          </div>

          {/* Variants Preview */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-4">
              <div className="flex gap-1">
                {product.variants.slice(0, 4).map((variant, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full border-2 border-gray-200"
                    style={{ backgroundColor: variant.color }}
                    title={variant.name}
                  />
                ))}
                {product.variants.length > 4 && (
                  <span className="text-xs text-gray-500 ml-1">
                    +{product.variants.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Add to Cart Button */}
      <div className="px-6 pb-6">
        <button
          onClick={handleAddToCart}
          disabled={product.inStock === false}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            product.inStock === false
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
          }`}
        >
          {product.inStock === false ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
