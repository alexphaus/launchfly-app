'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CartContext } from '@/components/launchfly-ui/EcommerceComponents';

export default function EnhancedProductPage() {
  const params = useParams();
  const router = useRouter();
  const [businessData, setBusiness] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const { addToCart } = useContext(CartContext) || {};
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadBusinessAndProduct();
  }, []);

  async function loadBusinessAndProduct() {
    try {
      const subdomain = await params.subdomain;
      const productId = await params.productId;

      // Get business data
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('status', 'ready')
        .single();

      if (businessError || !business) {
        console.error('Business not found:', businessError);
        setLoading(false);
        return;
      }

      setBusiness(business);

      // Find the product in the business data
      const businessContent = business.business_data;
      let foundProduct = null;

      // Look for products in different places in the business data
      if (businessContent?.products && Array.isArray(businessContent.products)) {
        foundProduct = businessContent.products.find(p => 
          p.id === productId || 
          p.name === productId ||
          p.name.toLowerCase().replace(/\s+/g, '-') === productId
        );
      }

      // Also check in layout sections
      if (!foundProduct && businessContent?.layout) {
        for (const section of businessContent.layout) {
          if ((section.component === 'ProductGrid' || section.component === 'EcommerceProductGrid') && section.props?.products) {
            foundProduct = section.props.products.find(p => 
              p.id === productId || 
              p.name === productId || 
              p.name.toLowerCase().replace(/\s+/g, '-') === productId
            );
            if (foundProduct) break;
          }
        }
      }

      if (foundProduct) {
        // Set default variant if variants exist
        if (foundProduct.variants && foundProduct.variants.length > 0) {
          setSelectedVariant(foundProduct.variants[0]);
        }
      }

      setProduct(foundProduct);
      setLoading(false);
    } catch (error) {
      console.error('Error loading product:', error);
      setLoading(false);
    }
  }

  const handleAddToCart = () => {
    if (!product || !addToCart) return;
    
    const productToAdd = {
      ...product,
      ...(selectedVariant && { 
        price: selectedVariant.price,
        variant: selectedVariant.name 
      })
    };
    
    addToCart(productToAdd, quantity);
    
    // Show success message
    alert(`Added ${quantity} ${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''} to cart!`);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    
    const productToCheckout = {
      ...product,
      ...(selectedVariant && { 
        price: selectedVariant.price,
        variant: selectedVariant.name 
      }),
      quantity
    };

    // Redirect to checkout with this product
    const checkoutData = encodeURIComponent(JSON.stringify([productToCheckout]));
    window.location.href = `/${params.subdomain}/checkout?items=${checkoutData}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const originalPrice = selectedVariant ? selectedVariant.originalPrice : product.originalPrice;
  const images = product.images || (product.image ? [product.image] : []);
  const hasDiscount = originalPrice && originalPrice !== currentPrice;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Products
            </button>
            
            <h1 className="font-semibold text-lg" style={{ color: 'var(--primary, #3b82f6)' }}>
              {businessData?.business_data?.businessName || 'Store'}
            </h1>
          </div>
        </div>
      </nav>

      {/* Product Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-lg">
              {images.length > 0 ? (
                <img 
                  src={images[activeImageIndex]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">
                  {product.icon || '📦'}
                </div>
              )}
            </div>
            
            {/* Image Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      activeImageIndex === index 
                        ? 'ring-2 ring-offset-2' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ 
                      borderColor: activeImageIndex === index ? 'var(--primary, #3b82f6)' : '#e5e7eb',
                      '--tw-ring-color': 'var(--primary, #3b82f6)'
                    }}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
                {product.name}
              </h1>
              
              {/* Rating */}
              {product.rating && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-5 h-5 ${i < Math.floor(product.rating) ? 'fill-current' : 'text-gray-300'}`}
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {product.rating} ({product.reviewCount || 0} reviews)
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
                  {currentPrice}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-2xl text-gray-500 line-through">
                      {originalPrice}
                    </span>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-semibold">
                      Save {Math.round((1 - parseFloat(currentPrice.replace(/[^0-9.-]+/g, '')) / parseFloat(originalPrice.replace(/[^0-9.-]+/g, ''))) * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Choose Option:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {product.variants.map((variant, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedVariant(variant)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedVariant?.name === variant.name
                          ? 'ring-2 ring-offset-2'
                          : 'hover:border-gray-400'
                      }`}
                      style={{ 
                        borderColor: selectedVariant?.name === variant.name ? 'var(--primary, #3b82f6)' : '#e5e7eb',
                        '--tw-ring-color': 'var(--primary, #3b82f6)'
                      }}
                    >
                      <div className="font-medium">{variant.name}</div>
                      <div className="text-sm" style={{ color: 'var(--primary, #3b82f6)' }}>
                        {variant.price}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <h3 className="font-semibold mb-3">Quantity:</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleBuyNow}
                className="w-full py-4 px-6 rounded-xl font-semibold text-white shadow-lg hover:scale-105 transition-all text-lg"
                style={{ background: 'var(--primary, #3b82f6)' }}
              >
                Buy Now - {currentPrice}
              </button>
              
              {addToCart && (
                <button
                  onClick={handleAddToCart}
                  className="w-full py-4 px-6 rounded-xl font-semibold border-2 hover:text-white hover:scale-105 transition-all text-lg"
                  style={{
                    borderColor: 'var(--primary, #3b82f6)',
                    color: 'var(--primary, #3b82f6)'
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
                  Add to Cart
                </button>
              )}
            </div>

            {/* Product Description */}
            <div>
              <h3 className="font-semibold mb-3">Description:</h3>
              <div className="text-gray-700 space-y-2">
                <p className={showFullDescription ? '' : 'line-clamp-3'}>
                  {product.description}
                </p>
                {product.longDescription && (
                  <div className={showFullDescription ? 'space-y-2' : 'hidden'}>
                    <p>{product.longDescription}</p>
                  </div>
                )}
                {(product.longDescription || product.description.length > 200) && (
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="text-sm font-medium hover:underline"
                    style={{ color: 'var(--primary, #3b82f6)' }}
                  >
                    {showFullDescription ? 'Show Less' : 'Show More'}
                  </button>
                )}
              </div>
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Features:</h3>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: 'var(--primary, #3b82f6)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specifications */}
            {product.specifications && (
              <div>
                <h3 className="font-semibold mb-3">Specifications:</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="border-b border-gray-200 pb-1">
                      <span className="font-medium text-gray-600">{key}:</span>
                      <span className="ml-2 text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
