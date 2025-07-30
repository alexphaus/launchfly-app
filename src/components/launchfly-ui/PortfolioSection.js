'use client';
import { useState } from 'react';

export default function PortfolioSection({ 
  title = "Our Work",
  subtitle = "See what we can create for you",
  items = []
}) {
  const [activeCategory, setActiveCategory] = useState('all');

  const defaultItems = [
    {
      title: "Project One",
      category: "design",
      image: null,
      description: "Beautiful design solution",
      link: "#"
    },
    {
      title: "Project Two", 
      category: "development",
      image: null,
      description: "Custom development work",
      link: "#"
    },
    {
      title: "Project Three",
      category: "design",
      image: null,
      description: "Brand identity design",
      link: "#"
    },
    {
      title: "Project Four",
      category: "strategy",
      image: null,
      description: "Strategic consulting",
      link: "#"
    }
  ];

  const displayItems = items.length > 0 ? items : defaultItems;
  
  // Get unique categories
  const categories = ['all', ...new Set(displayItems.map(item => item.category))];
  
  // Filter items based on active category
  const filteredItems = activeCategory === 'all' 
    ? displayItems 
    : displayItems.filter(item => item.category === activeCategory);

  return (
    <section className="py-20" style={{ background: 'var(--background, #ffffff)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1a1a1a)' }}>
            {title}
          </h2>
          <p className="text-xl max-w-2xl mx-auto mb-8" style={{ color: 'var(--text-gray, #666666)' }}>
            {subtitle}
          </p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  activeCategory === category 
                    ? 'text-white shadow-lg' 
                    : 'border-2 hover:scale-105'
                }`}
                style={{
                  background: activeCategory === category 
                    ? 'var(--gradient-bg, linear-gradient(135deg, #3b82f6 0%, #1e40af 100%))' 
                    : 'transparent',
                  borderColor: 'var(--primary, #3b82f6)',
                  color: activeCategory === category 
                    ? 'white' 
                    : 'var(--primary, #3b82f6)'
                }}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Portfolio Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item, index) => (
            <div key={index} className="group cursor-pointer">
              <div className="relative overflow-hidden rounded-2xl shadow-lg transition-all group-hover:scale-105 group-hover:shadow-xl">
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-64 object-cover"
                  />
                ) : (
                  <div 
                    className="w-full h-64 flex items-center justify-center text-4xl"
                    style={{ background: 'var(--gradient-bg, linear-gradient(135deg, #3b82f6 0%, #1e40af 100%))' }}
                  >
                    🎨
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all flex items-center justify-center">
                  <div className="text-white text-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-sm mb-4">{item.description}</p>
                    <span className="inline-block px-4 py-2 bg-white text-black rounded-full font-medium">
                      View Project
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
