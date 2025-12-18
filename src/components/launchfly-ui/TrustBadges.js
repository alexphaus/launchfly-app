// src/components/launchfly-ui/TrustBadges.js
'use client';

export default function TrustBadges({ 
  badges = [],
  variant = 'default', // 'default' | 'emergency' | 'minimal'
  showRating = true,
  rating = 5,
  reviewCount = 127,
  id = "trust"
}) {
  const defaultBadges = [
    { icon: '✅', text: 'Licensed & Insured' },
    { icon: '⭐', text: '5-Star Rated' },
    { icon: '🏆', text: 'Top Rated Pro' },
    { icon: '⚡', text: 'Same Day Service' }
  ];

  const emergencyBadges = [
    { icon: '🚨', text: '24/7 Emergency' },
    { icon: '⏰', text: 'Fast Response' },
    { icon: '✅', text: 'Licensed & Insured' },
    { icon: '💳', text: 'Upfront Pricing' }
  ];

  const displayBadges = badges.length > 0 
    ? badges.map(b => typeof b === 'string' ? { icon: '✅', text: b } : b)
    : (variant === 'emergency' ? emergencyBadges : defaultBadges);

  // Emergency variant - more prominent, darker background
  if (variant === 'emergency') {
    return (
      <section className="py-8 bg-slate-900" id={id}>
        <div className="max-w-6xl mx-auto px-4">
          {/* Rating Display */}
          {showRating && (
            <div className="flex justify-center items-center gap-2 mb-6">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={`text-2xl ${i < rating ? 'text-yellow-400' : 'text-gray-600'}`}>
                    ★
                  </span>
                ))}
              </div>
              <span className="text-white font-bold text-lg">{rating}.0</span>
              <span className="text-gray-400">({reviewCount}+ reviews)</span>
            </div>
          )}
          
          {/* Badge Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {displayBadges.map((badge, index) => (
              <div 
                key={index}
                className="flex items-center justify-center gap-2 bg-slate-800 rounded-lg py-3 px-4 border border-slate-700"
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-white font-medium text-sm">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Minimal variant - simple inline badges
  if (variant === 'minimal') {
    return (
      <div className="flex flex-wrap justify-center gap-4 py-4" id={id}>
        {displayBadges.map((badge, index) => (
          <div 
            key={index}
            className="flex items-center gap-1 text-sm text-gray-600"
          >
            <span>{badge.icon}</span>
            <span>{badge.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // Default variant
  return (
    <section className="py-12 bg-gradient-to-r from-blue-50 to-indigo-50" id={id}>
      <div className="max-w-6xl mx-auto px-4">
        {/* Rating Display */}
        {showRating && (
          <div className="flex justify-center items-center gap-3 mb-8">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={`text-3xl ${i < rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                  ★
                </span>
              ))}
            </div>
            <div>
              <span className="text-2xl font-bold text-gray-900">{rating}.0</span>
              <span className="text-gray-500 ml-2">({reviewCount}+ reviews)</span>
            </div>
          </div>
        )}
        
        {/* Badge Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {displayBadges.map((badge, index) => (
            <div 
              key={index}
              className="flex flex-col items-center justify-center bg-white rounded-xl py-6 px-4 shadow-md hover:shadow-lg transition-shadow"
            >
              <span className="text-4xl mb-2">{badge.icon}</span>
              <span className="text-gray-800 font-semibold text-center">{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
