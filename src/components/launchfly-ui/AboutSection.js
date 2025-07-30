'use client';

export default function AboutSection({ 
  title = "About Us",
  subtitle = "Our Story",
  content = "We're passionate about helping you achieve your goals. With years of experience and a proven track record, we deliver results that matter.",
  image,
  ctaText = "Learn More",
  ctaLink = "#contact",
  layout = "left" // "left", "right", or "center"
}) {

  if (layout === "center") {
    return (
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: 'var(--text-dark, #1a1a1a)' }}>
            {title}
          </h2>
          {subtitle && (
            <h3 className="text-xl font-semibold mb-8" style={{ color: 'var(--primary, #3b82f6)' }}>
              {subtitle}
            </h3>
          )}
          <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-gray, #666666)' }}>
            {content}
          </p>
          {ctaText && (
            <a
              href={ctaLink}
              className="inline-block px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 shadow-lg text-white"
              style={{ background: 'var(--gradient-bg, linear-gradient(135deg, #3b82f6 0%, #1e40af 100%))' }}
            >
              {ctaText}
            </a>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid md:grid-cols-2 gap-12 items-center ${layout === "right" ? "md:grid-flow-col-dense" : ""}`}>
          <div className={layout === "right" ? "md:col-start-2" : ""}>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: 'var(--text-dark, #1a1a1a)' }}>
              {title}
            </h2>
            {subtitle && (
              <h3 className="text-xl font-semibold mb-6" style={{ color: 'var(--primary, #3b82f6)' }}>
                {subtitle}
              </h3>
            )}
            <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-gray, #666666)' }}>
              {content}
            </p>
            {ctaText && (
              <a
                href={ctaLink}
                className="inline-block px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 shadow-lg text-white"
                style={{ background: 'var(--gradient-bg, linear-gradient(135deg, #3b82f6 0%, #1e40af 100%))' }}
              >
                {ctaText}
              </a>
            )}
          </div>
          
          <div className={layout === "right" ? "md:col-start-1" : ""}>
            <div className="relative">
              {image ? (
                <img 
                  src={image} 
                  alt={title}
                  className="w-full h-96 object-cover rounded-2xl shadow-xl"
                />
              ) : (
                <div 
                  className="w-full h-96 rounded-2xl shadow-xl flex items-center justify-center text-6xl"
                  style={{ background: 'var(--gradient-bg, linear-gradient(135deg, #3b82f6 0%, #1e40af 100%))' }}
                >
                  👋
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
