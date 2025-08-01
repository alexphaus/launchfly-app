'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ProductGrid({
  title = "Our Products",
  subtitle = "Check out our latest offerings",
  products = [],
  columns = 3,
}) {
  const router = useRouter();
  
  const defaultProducts = [
    {
      id: "product-1",
      name: "Essential Package",
      price: "$99",
      description: "Perfect for small businesses getting started",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
      features: ["24/7 Support", "Core Features", "30-Day Guarantee"]
    },
    {
      id: "product-2",
      name: "Professional Suite",
      price: "$199",
      description: "Advanced tools for growing businesses",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
      features: ["Priority Support", "All Features", "60-Day Guarantee"]
    },
    {
      id: "product-3",
      name: "Enterprise Solution",
      price: "$399",
      description: "Complete solution for large organizations",
      image: "https://images.unsplash.com/photo-1553456558-aff63285bdd1",
      features: ["Dedicated Account Manager", "Custom Development", "90-Day Guarantee"]
    }
  ];

  const displayProducts = products.length > 0 ? products : defaultProducts;
  
  // Navigate to product detail page
  const handleProductClick = (product) => {
    try {
      // Get current URL
      const currentUrl = window.location.href;
      
      // Get the subdomain from the URL
      const urlParts = new URL(currentUrl);
      const pathParts = urlParts.pathname.split('/');
      
      // Check if we're on a subdomain site page
      if (pathParts.includes('sites')) {
        const subdomainIndex = pathParts.findIndex(part => part === 'sites') + 1;
        const subdomain = pathParts[subdomainIndex];
        
        if (subdomain) {
          // Generate the product URL (using ID or slug)
          const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
          const productUrl = `/sites/${subdomain}/product/${productId}`;
          
          console.log('Navigating to product page:', productUrl);
          
          // Navigate to the product page
          router.push(productUrl);
          return;
        }
      }
      
      // Fallback navigation if we can't determine the structure
      const baseUrl = currentUrl.split('/').slice(0, -1).join('/');
      const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
      const productUrl = `${baseUrl}/product/${productId}`;
      
      router.push(productUrl);
    } catch (error) {
      console.error('Error navigating to product:', error);
      
      // Last resort fallback
      const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
      router.push(`/product/${productId}`);
    }
  };
  
  // Calculate grid columns class
  const getGridClass = () => {
    switch(columns) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 md:grid-cols-2';
      case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      default: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    }
  };

  return (
    <section className="py-16 bg-white" id="products">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: 'var(--text-dark, #1f2937)' }}
          >
            {title}
          </h2>
          {subtitle && (
            <p 
              className="text-xl max-w-3xl mx-auto"
              style={{ color: 'var(--text-gray, #6b7280)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Products Grid */}
        <div className={`grid ${getGridClass()} gap-8`}>
          {displayProducts.map((product, index) => (
            <div 
              key={product.id || index}
              className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100"
              onClick={() => handleProductClick(product)}
            >
              {/* Product Image */}
              <div className="relative h-60 w-full bg-gray-100">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    style={{ objectFit: 'cover' }}
                    className="hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl">🛍️</span>
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 
                    className="text-xl font-bold"
                    style={{ color: 'var(--text-dark, #1f2937)' }}
                  >
                    {product.name}
                  </h3>
                  <span 
                    className="text-xl font-bold"
                    style={{ color: 'var(--primary, #3b82f6)' }}
                  >
                    {product.price}
                  </span>
                </div>
                
                <p 
                  className="text-sm mb-4"
                  style={{ color: 'var(--text-gray, #6b7280)' }}
                >
                  {product.description}
                </p>
                
                {/* Features List */}
                {product.features && product.features.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {product.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm">
                        <svg 
                          className="w-4 h-4 mr-2 flex-shrink-0"
                          style={{ color: 'var(--primary, #3b82f6)' }} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span style={{ color: 'var(--text-gray, #6b7280)' }}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                
                {/* View Details Button */}
                <div 
                  className="mt-4 text-center py-2 rounded-lg font-medium"
                  style={{ 
                    backgroundColor: 'var(--primary, #3b82f6)',
                    color: 'white'
                  }}
                >
                  View Details
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
