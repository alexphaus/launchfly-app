// src/components/launchfly-ui/ImageGallery.js
'use client';

import { useState } from 'react';

export default function ImageGallery({ 
  title = "Our Work",
  subtitle = "See what we can do for you",
  images = [],
  variant = 'grid', // 'grid' | 'masonry' | 'carousel'
  columns = 3,
  id = "gallery"
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const defaultImages = [
    { url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600', alt: 'Project 1', caption: 'Beautiful transformation' },
    { url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600', alt: 'Project 2', caption: 'Stunning results' },
    { url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=600', alt: 'Project 3', caption: 'Quality work' },
    { url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600', alt: 'Project 4', caption: 'Client favorite' },
    { url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600', alt: 'Project 5', caption: 'Premium service' },
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600', alt: 'Project 6', caption: 'Expert finish' }
  ];

  const displayImages = images.length > 0 ? images : defaultImages;

  const openLightbox = (index) => {
    setSelectedImage(displayImages[index]);
    setCurrentIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const nextImage = () => {
    const newIndex = (currentIndex + 1) % displayImages.length;
    setCurrentIndex(newIndex);
    setSelectedImage(displayImages[newIndex]);
  };

  const prevImage = () => {
    const newIndex = (currentIndex - 1 + displayImages.length) % displayImages.length;
    setCurrentIndex(newIndex);
    setSelectedImage(displayImages[newIndex]);
  };

  // Carousel variant
  if (variant === 'carousel') {
    return (
      <section className="py-16 bg-white" id={id}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
              {title}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-gray, #6b7280)' }}>
              {subtitle}
            </p>
          </div>

          <div className="relative overflow-hidden">
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 scrollbar-hide">
              {displayImages.map((image, index) => (
                <div 
                  key={index}
                  className="flex-none w-80 snap-center cursor-pointer"
                  onClick={() => openLightbox(index)}
                >
                  <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                    <img 
                      src={image.url} 
                      alt={image.alt || `Image ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  {image.caption && (
                    <p className="text-center text-gray-600 mt-2 text-sm">{image.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <button 
              className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
              onClick={closeLightbox}
            >
              ×
            </button>
            <button 
              className="absolute left-4 text-white text-4xl hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
            >
              ‹
            </button>
            <img 
              src={selectedImage.url} 
              alt={selectedImage.alt}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute right-4 text-white text-4xl hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
            >
              ›
            </button>
          </div>
        )}
      </section>
    );
  }

  // Masonry variant
  if (variant === 'masonry') {
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

          <div className="columns-2 md:columns-3 gap-4 space-y-4">
            {displayImages.map((image, index) => (
              <div 
                key={index}
                className="break-inside-avoid cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <div className="rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
                  <img 
                    src={image.url} 
                    alt={image.alt || `Image ${index + 1}`}
                    className="w-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lightbox */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <button 
              className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
              onClick={closeLightbox}
            >
              ×
            </button>
            <button 
              className="absolute left-4 text-white text-4xl hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
            >
              ‹
            </button>
            <img 
              src={selectedImage.url} 
              alt={selectedImage.alt}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute right-4 text-white text-4xl hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
            >
              ›
            </button>
          </div>
        )}
      </section>
    );
  }

  // Default grid variant
  return (
    <section className="py-16 bg-white" id={id}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
          <p className="text-lg" style={{ color: 'var(--text-gray, #6b7280)' }}>
            {subtitle}
          </p>
        </div>

        <div className={`grid grid-cols-2 ${columns >= 3 ? 'md:grid-cols-3' : ''} ${columns >= 4 ? 'lg:grid-cols-4' : ''} gap-4`}>
          {displayImages.map((image, index) => (
            <div 
              key={index}
              className="aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              <img 
                src={image.url} 
                alt={image.alt || `Image ${index + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button 
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
            onClick={closeLightbox}
          >
            ×
          </button>
          <button 
            className="absolute left-4 text-white text-4xl hover:text-gray-300"
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
          >
            ‹
          </button>
          <img 
            src={selectedImage.url} 
            alt={selectedImage.alt}
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            className="absolute right-4 text-white text-4xl hover:text-gray-300"
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
          >
            ›
          </button>
          {selectedImage.caption && (
            <p className="absolute bottom-8 text-white text-center w-full">
              {selectedImage.caption}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
