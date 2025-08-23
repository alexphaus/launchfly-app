// src/components/launchfly-ui/Hero.js
'use client';

export default function Hero({ 
  title = "Transform Your Vision Into Reality", 
  subtitle = "Professional solutions tailored to your unique needs", 
  ctaText = "Get Started Today", 
  ctaLink = "#contact",
  secondaryCtaText = "Learn More",
  secondaryCtaLink = "#about",
  backgroundImage,
  backgroundOverlay
}) {
  // Enhanced gradient overlays based on business type
  const getDefaultOverlay = () => {
    if (backgroundImage) {
      return backgroundOverlay || 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)';
    }
    return 'var(--gradient-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%))';
  };

  const backgroundStyle = {
    background: backgroundImage 
      ? `${getDefaultOverlay()}, url(${backgroundImage})`
      : getDefaultOverlay(),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    // Removed backgroundAttachment: 'fixed' for better performance
  };

  return (
    <section 
      className="relative py-20 lg:py-32 overflow-hidden min-h-[80vh] flex items-center"
      style={backgroundStyle}
    >
      {/* Simplified Background Elements - Reduced animations for better performance */}
      <div className="absolute inset-0">
        {/* Static Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-blue-500/10"></div>
        
        {/* Static Decorative Elements - No animations to improve performance */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
          <div className="absolute top-40 right-20 w-32 h-32 bg-white/3 rounded-full blur-2xl"></div>
          <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-white/4 rounded-full blur-lg"></div>
        </div>
      </div>
      
      {/* Content */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        {/* Optimized Title - Removed heavy animations */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          <span className="drop-shadow-lg">
            {title}
          </span>
        </h1>
        
        {/* Optimized Subtitle */}
        <p className="text-xl md:text-2xl text-white/95 mb-10 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
          {subtitle}
        </p>
        
        {/* Optimized CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={ctaLink}
            className="group px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 text-white shadow-2xl relative overflow-hidden"
            style={{ 
              background: 'var(--primary, #3b82f6)',
            }}
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <span className="relative z-10">{ctaText}</span>
          </a>
          
          {secondaryCtaText && (
            <a
              href={secondaryCtaLink}
              className="group px-8 py-4 rounded-full font-semibold text-lg border-2 border-white/80 text-white hover:bg-white/10 hover:border-white transition-all duration-300 backdrop-blur-sm"
            >
              <span className="group-hover:text-white transition-colors duration-300">
                {secondaryCtaText}
              </span>
            </a>
          )}
        </div>

        {/* Trust indicators or additional elements */}
        <div className="mt-12 flex justify-center items-center space-x-8 text-white/70">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>
            <span className="text-sm font-medium">Trusted by thousands</span>
          </div>
          <div className="text-sm">•</div>
          <div className="text-sm font-medium">Professional results guaranteed</div>
        </div>
      </div>
    </section>
  );
}
