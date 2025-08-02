// components/LiveWebsitePreview.js
'use client';
import { useState, useEffect } from 'react';

const LiveWebsitePreview = ({ businessData, isStreaming, activities }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [showProducts, setShowProducts] = useState([]);
  const [animateColors, setAnimateColors] = useState(false);

  // Typewriter effect for hero text
  useEffect(() => {
    if (businessData?.hero?.title && businessData.hero.title !== 'Loading...') {
      let index = 0;
      const text = businessData.hero.title;
      setDisplayedText('');
      
      const timer = setInterval(() => {
        setDisplayedText(text.slice(0, index + 1));
        index++;
        if (index >= text.length) clearInterval(timer);
      }, 100);
      
      return () => clearInterval(timer);
    }
  }, [businessData?.hero?.title]);

  // Animate colors when theme changes
  useEffect(() => {
    if (businessData?.theme && businessData.theme.primaryColor !== '#3b82f6') {
      setAnimateColors(true);
      setTimeout(() => setAnimateColors(false), 1000);
    }
  }, [businessData?.theme]);

  // Progressive product loading
  useEffect(() => {
    if (businessData?.products?.length > 0) {
      businessData.products.forEach((product, index) => {
        setTimeout(() => {
          setShowProducts(prev => {
            const newArray = [...prev];
            newArray[index] = true;
            return newArray;
          });
        }, index * 1000);
      });
    }
  }, [businessData?.products?.length]);

  const theme = businessData?.theme || {
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    backgroundColor: '#ffffff',
    textColor: '#1f2937'
  };

  const isLoading = !businessData || businessData.business_name === 'Your Business';

  return (
    <div style={{ 
      background: theme.backgroundColor,
      color: theme.textColor,
      transition: animateColors ? 'all 0.8s ease-in-out' : 'none'
    }} className="w-full h-96 border border-gray-200 rounded-lg overflow-hidden relative">
      
      {/* Loading Skeleton */}
      {isLoading && (
        <div className="animate-pulse h-full bg-gray-50">
          <div className="h-24 bg-gray-200 mb-4"></div>
          <div className="px-6 space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded w-32 mt-6"></div>
          </div>
        </div>
      )}

      {/* Live Website Content */}
      {!isLoading && (
        <div className="h-full overflow-y-auto">
          {/* Header */}
          <header style={{ background: theme.primaryColor }} className="p-4 text-white">
            <div className="flex justify-between items-center">
              <h1 className={`text-xl font-bold transition-all duration-500 ${
                businessData.business_name === 'Your Business' ? 'opacity-50' : 'opacity-100'
              }`}>
                {businessData.business_name || 'Your Business'}
              </h1>
              <div className="flex space-x-4 text-sm">
                <span>Home</span>
                <span>About</span>
                <span>Products</span>
                <span>Contact</span>
              </div>
            </div>
          </header>

          {/* Hero Section */}
          <section className="px-6 py-12 text-center">
            <h2 className="text-3xl font-bold mb-4 min-h-12">
              {businessData.hero?.title === 'Loading...' ? (
                <span className="text-gray-400">Loading...</span>
              ) : (
                <span className="typewriter">
                  {displayedText}
                  <span className="animate-pulse">|</span>
                </span>
              )}
            </h2>
            
            <p className={`text-lg mb-6 transition-opacity duration-500 ${
              businessData.hero?.subtitle ? 'opacity-100' : 'opacity-50'
            }`}>
              {businessData.hero?.subtitle || 'Please wait while we create your business'}
            </p>
            
            <button 
              style={{ 
                background: theme.primaryColor,
                opacity: businessData.hero?.ctaText ? 1 : 0.5
              }}
              className="px-6 py-3 text-white rounded-lg font-semibold transition-all duration-300 hover:scale-105"
            >
              {businessData.hero?.ctaText || 'Get Started'}
            </button>
          </section>

          {/* Products Section */}
          <section className="px-6 py-8 bg-gray-50">
            <h3 className="text-2xl font-bold text-center mb-8">Our Products</h3>
            
            {(!businessData.products || businessData.products.length === 0) ? (
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white p-6 rounded-lg shadow-sm animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {businessData.products.map((product, index) => (
                  <div 
                    key={index} 
                    className={`bg-white p-6 rounded-lg shadow-sm transition-all duration-500 transform ${
                      showProducts[index] 
                        ? 'opacity-100 translate-y-0 scale-100' 
                        : 'opacity-0 translate-y-4 scale-95'
                    }`}
                  >
                    <h4 className="font-bold text-lg mb-2">{product.name}</h4>
                    <p className="text-gray-600 mb-3">{product.description}</p>
                    <div className="text-xl font-bold mb-3" style={{ color: theme.primaryColor }}>
                      {product.price}
                    </div>
                    {product.features && (
                      <ul className="text-sm space-y-1 mb-4">
                        {product.features.slice(0, 3).map((feature, fIndex) => (
                          <li key={fIndex} className="flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button 
                      style={{ background: theme.primaryColor }}
                      className="w-full py-2 text-white rounded font-semibold hover:opacity-90 transition-opacity"
                    >
                      Buy Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Visitor Counter */}
          {businessData?.views > 0 && (
            <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-2 rounded-full text-sm font-bold animate-bounce">
              👥 {businessData.views} visitor{businessData.views !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Real-time Activity Indicator */}
      {isStreaming && (
        <div className="absolute top-2 right-2 flex items-center space-x-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>LIVE</span>
        </div>
      )}

      <style jsx>{`
        .typewriter {
          font-family: monospace;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .fade-in-up {
          animation: fadeInUp 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LiveWebsitePreview;
