// src/components/launchfly-ui/FeatureGrid.js
'use client';

export default function FeatureGrid({ 
  title = "Why Choose Us", 
  subtitle = "Everything you need to succeed",
  features = [],
  id = "features"
}) {
  const defaultFeatures = [
    {
      icon: "⚡",
      title: "Fast & Reliable",
      description: "Quick turnaround times with consistent quality results"
    },
    {
      icon: "🎯",
      title: "Targeted Solutions",
      description: "Customized approaches designed for your specific needs"
    },
    {
      icon: "🚀",
      title: "Growth Focused",
      description: "Strategies that scale with your business success"
    }
  ];

  const displayFeatures = features.length > 0 ? features : defaultFeatures;

  return (
    <section className="py-20 bg-gray-50" id={id}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-gray, #6b7280)' }}>
            {subtitle}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayFeatures.map((feature, index) => (
            <div 
              key={index}
              className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              style={{ borderTop: `4px solid var(--primary, #3b82f6)` }}
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-dark, #1f2937)' }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-gray, #6b7280)' }} className="leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
