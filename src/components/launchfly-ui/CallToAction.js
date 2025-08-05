// src/components/launchfly-ui/CallToAction.js
'use client';

export default function CallToAction({ 
  title = "Ready to Get Started?",
  subtitle = "Join thousands of satisfied customers today",
  ctaText = "Start Now",
  ctaLink = "#contact",
  secondaryCtaText = "Learn More",
  secondaryCtaLink = "#about"
}) {
  return (
    <section className="py-20" style={{ background: 'var(--primary, #3b82f6)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          {title}
        </h2>
        <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
          {subtitle}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={ctaLink}
            className="px-8 py-4 bg-white rounded-full font-bold text-lg transition-all hover:scale-105 shadow-xl"
            style={{ color: 'var(--primary, #3b82f6)' }}
          >
            {ctaText}
          </a>
          {secondaryCtaText && (
            <a
              href={secondaryCtaLink}
              className="px-8 py-4 rounded-full font-semibold text-lg border-2 border-white text-white hover:bg-white transition-all"
              style={{ '--hover-color': 'var(--primary, #3b82f6)' }}
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
