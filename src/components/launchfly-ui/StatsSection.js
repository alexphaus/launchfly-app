'use client';

export default function StatsSection({ 
  title = "By the Numbers",
  subtitle = "Proven results that speak for themselves",
  stats = []
}) {
  const defaultStats = [
    {
      number: "1000+",
      label: "Happy Clients",
      icon: "👥"
    },
    {
      number: "98%",
      label: "Success Rate",
      icon: "📈"
    },
    {
      number: "24/7",
      label: "Support",
      icon: "🛟"
    },
    {
      number: "5★",
      label: "Average Rating",
      icon: "⭐"
    }
  ];

  const displayStats = stats.length > 0 ? stats : defaultStats;

  return (
    <section className="py-20" style={{ background: 'var(--background, #f9fafb)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1a1a1a)' }}>
            {title}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-gray, #666666)' }}>
            {subtitle}
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {displayStats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div 
                className="text-3xl md:text-4xl font-bold mb-2" 
                style={{ color: 'var(--primary, #3b82f6)' }}
              >
                {stat.number}
              </div>
              <div 
                className="text-sm md:text-base font-medium" 
                style={{ color: 'var(--text-gray, #666666)' }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
