'use client';

import { useState } from 'react';

/**
 * ImageGallery - Displays uploaded prospect images with Before/After styling
 * Used in landing pages to showcase real work examples
 */
export default function ImageGallery({ 
  title = 'Our Work', 
  subtitle = 'See the quality of our work',
  images = [],
  id = 'gallery'
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  
  if (!images || images.length === 0) return null;

  // Group images by type for better display
  const beforeImages = images.filter(img => img.type === 'before');
  const afterImages = images.filter(img => img.type === 'after');
  const teamImages = images.filter(img => img.type === 'team');
  const workImages = images.filter(img => img.type === 'work');
  const generalImages = images.filter(img => img.type === 'general' || !img.type);
  
  // Check if we have a before/after pair
  const hasBeforeAfter = beforeImages.length > 0 && afterImages.length > 0;

  const getLabelText = (type) => {
    const labels = {
      'before': 'Before',
      'after': 'After', 
      'team': 'Our Team',
      'work': 'Work in Progress',
      'general': ''
    };
    return labels[type] || '';
  };

  const getLabelColor = (type) => {
    const colors = {
      'before': 'bg-red-500',
      'after': 'bg-green-500',
      'team': 'bg-blue-500',
      'work': 'bg-amber-500',
      'general': 'bg-gray-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <section id={id} className="py-16 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            📸 {title}
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Before/After Comparison (if available) */}
        {hasBeforeAfter && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-slate-800 mb-6 text-center">
              Before & After
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {beforeImages[0] && (
                <div className="relative group cursor-pointer" onClick={() => setSelectedImage(beforeImages[0])}>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-lg border-4 border-red-200">
                    <img 
                      src={beforeImages[0].url} 
                      alt="Before"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <span className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full shadow">
                    BEFORE
                  </span>
                </div>
              )}
              {afterImages[0] && (
                <div className="relative group cursor-pointer" onClick={() => setSelectedImage(afterImages[0])}>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-lg border-4 border-green-200">
                    <img 
                      src={afterImages[0].url} 
                      alt="After"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <span className="absolute top-4 left-4 px-3 py-1 bg-green-500 text-white text-sm font-bold rounded-full shadow">
                    AFTER
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Images */}
        {teamImages.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-slate-800 mb-6 text-center">
              👷 Meet Our Team
            </h3>
            <div className="flex flex-wrap justify-center gap-6">
              {teamImages.map((img, index) => (
                <div 
                  key={index}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedImage(img)}
                >
                  <div className="w-48 h-48 rounded-full overflow-hidden shadow-lg border-4 border-blue-200">
                    <img 
                      src={img.url} 
                      alt={`Team member ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Work in Progress / General Gallery */}
        {(workImages.length > 0 || generalImages.length > 0) && (
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-6 text-center">
              🔧 Recent Projects
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...workImages, ...generalImages].map((img, index) => (
                <div 
                  key={index}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedImage(img)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                    <img 
                      src={img.url} 
                      alt={img.name || `Project ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  {img.type && img.type !== 'general' && (
                    <span className={`absolute bottom-2 left-2 px-2 py-1 ${getLabelColor(img.type)} text-white text-xs font-medium rounded shadow`}>
                      {getLabelText(img.type)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trust Badge */}
        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500 italic">
            ✓ Real photos from actual projects • No stock images
          </p>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img 
              src={selectedImage.url}
              alt={selectedImage.name || 'Gallery image'}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            {selectedImage.type && selectedImage.type !== 'general' && (
              <span className={`absolute top-4 left-4 px-4 py-2 ${getLabelColor(selectedImage.type)} text-white font-bold rounded-full shadow-lg`}>
                {getLabelText(selectedImage.type)}
              </span>
            )}
            <button 
              className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center text-slate-800 font-bold shadow-lg"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
