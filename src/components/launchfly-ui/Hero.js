'use client';

export default function Hero({ 
  title = "Transform Your Vision Into Reality", 
  subtitle = "Professional solutions tailored to your unique needs", 
  ctaText = "Get Started Today", 
  ctaLink = "#contact",
  secondaryCtaText = "Learn More",
  secondaryCtaLink = "#about",
  backgroundImage 
}) {
  return (
    <section 
      className="relative py-20 lg:py-32 overflow-hidden"
      style={{
        background: backgroundImage 
          ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${backgroundImage})`
          : 'var(--gradient-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%))',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>
      </div>
      
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          {title}
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
          {subtitle}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={ctaLink}
            className="px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 text-white shadow-xl"
            style={{ 
              background: 'var(--primary, #3b82f6)',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
            }}
          >
            {ctaText}
          </a>
          {secondaryCtaText && (
            <a
              href={secondaryCtaLink}
              className="px-8 py-4 rounded-full font-semibold text-lg border-2 border-white text-white hover:bg-white transition-all"
              style={{ 
                '--hover-color': 'var(--primary, #3b82f6)'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = 'var(--primary, #3b82f6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = 'white';
              }}
            >
              {secondaryCtaText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
