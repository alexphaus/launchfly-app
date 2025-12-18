// src/components/launchfly-ui/PricingMenu.js
'use client';

export default function PricingMenu({ 
  title = "Our Services",
  subtitle = "Transparent pricing for all our services",
  items = [],
  currency = '$',
  variant = 'default', // 'default' | 'elegant' | 'card'
  showBookButton = true,
  bookButtonText = "Book Now",
  onBook = null,
  id = "pricing"
}) {
  const defaultItems = [
    { name: 'Basic Service', description: 'Standard service package', price: 99, duration: '1 hour' },
    { name: 'Premium Service', description: 'Full service with extras', price: 199, duration: '2 hours' },
    { name: 'Deluxe Package', description: 'Complete solution', price: 299, duration: '3 hours' }
  ];

  const displayItems = items.length > 0 ? items : defaultItems;

  // Elegant variant - for salons, spas, upscale services
  if (variant === 'elegant') {
    return (
      <section className="py-20 bg-white" id={id}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-light tracking-wide mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
              {title}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-gray, #6b7280)' }}>
              {subtitle}
            </p>
          </div>

          <div className="space-y-0">
            {displayItems.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between py-6 border-b border-gray-200 last:border-b-0 group hover:bg-gray-50 px-4 -mx-4 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                  )}
                  {item.duration && (
                    <span className="text-xs text-gray-400 mt-1 inline-block">
                      ⏱ {item.duration}
                    </span>
                  )}
                </div>
                <div className="text-right flex items-center gap-4">
                  <span className="text-xl font-semibold" style={{ color: 'var(--primary, #3b82f6)' }}>
                    {currency}{item.price}
                    {item.priceNote && <span className="text-sm font-normal text-gray-400 ml-1">{item.priceNote}</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {showBookButton && (
            <div className="text-center mt-12">
              <button 
                onClick={onBook}
                className="px-8 py-4 rounded-full font-medium text-white transition-all hover:scale-105 shadow-lg"
                style={{ backgroundColor: 'var(--primary, #3b82f6)' }}
              >
                {bookButtonText}
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Card variant - for restaurants, retail
  if (variant === 'card') {
    return (
      <section className="py-16 bg-gray-50" id={id}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
              {title}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-gray, #6b7280)' }}>
              {subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayItems.map((item, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
              >
                {item.image && (
                  <div className="h-48 bg-gray-200 overflow-hidden">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                    <span className="text-lg font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
                      {currency}{item.price}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-500">{item.description}</p>
                  )}
                  {item.tags && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default variant - clean list style
  return (
    <section className="py-16 bg-white" id={id}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
          <p className="text-lg" style={{ color: 'var(--text-gray, #6b7280)' }}>
            {subtitle}
          </p>
        </div>

        <div className="bg-gray-50 rounded-2xl overflow-hidden">
          {displayItems.map((item, index) => (
            <div 
              key={index}
              className={`flex items-center justify-between p-6 ${index !== displayItems.length - 1 ? 'border-b border-gray-200' : ''} hover:bg-gray-100 transition-colors`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-2xl">{item.icon}</span>}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {item.duration && (
                  <span className="text-sm text-gray-400 hidden sm:inline">
                    {item.duration}
                  </span>
                )}
                <span className="text-xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
                  {item.priceFrom && <span className="text-sm font-normal text-gray-400">from </span>}
                  {currency}{item.price}
                </span>
              </div>
            </div>
          ))}
        </div>

        {showBookButton && (
          <div className="text-center mt-8">
            <button 
              onClick={onBook}
              className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 shadow-md"
              style={{ backgroundColor: 'var(--primary, #3b82f6)' }}
            >
              {bookButtonText}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
