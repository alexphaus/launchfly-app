'use client';

import { useState } from 'react';

export default function TestimonialSlider({ 
  title = "What Our Clients Say",
  testimonials = []
}) {
  const defaultTestimonials = [
    {
      name: "Sarah Johnson",
      role: "Business Owner",
      content: "This service transformed my business. The results exceeded all my expectations!",
      avatar: "👩‍💼",
      rating: 5
    },
    {
      name: "Mike Chen",
      role: "Entrepreneur", 
      content: "Professional, reliable, and incredibly effective. Highly recommended!",
      avatar: "👨‍💻",
      rating: 5
    },
    {
      name: "Emily Davis",
      role: "Marketing Director",
      content: "The best investment I've made for my business growth strategy.",
      avatar: "👩‍🚀",
      rating: 5
    }
  ];

  const displayTestimonials = testimonials.length > 0 && testimonials.some(t => t.content && t.content.trim() !== '') 
    ? testimonials.filter(t => t.content && t.content.trim() !== '') 
    : defaultTestimonials;
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % displayTestimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + displayTestimonials.length) % displayTestimonials.length);
  };

  if (displayTestimonials.length === 0) return null;

  return (
    <section className="py-20 bg-white" id="testimonials">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
        </div>

        {/* Testimonial Slider */}
        <div className="relative">
          <div className="bg-gray-50 rounded-2xl p-8 md:p-12 text-center">
            {/* Stars */}
            <div className="flex justify-center mb-6">
              {[...Array(displayTestimonials[currentIndex].rating || 5)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-xl">⭐</span>
              ))}
            </div>

            {/* Quote */}
            <blockquote className="text-xl md:text-2xl font-medium mb-8 leading-relaxed" style={{ color: 'var(--text-dark, #1f2937)' }}>
              "{displayTestimonials[currentIndex].content}"
            </blockquote>

            {/* Author */}
            <div className="flex items-center justify-center space-x-4">
              <div className="text-3xl">
                {displayTestimonials[currentIndex].avatar}
              </div>
              <div className="text-left">
                <div className="font-bold" style={{ color: 'var(--text-dark, #1f2937)' }}>
                  {displayTestimonials[currentIndex].name}
                </div>
                <div style={{ color: 'var(--text-gray, #6b7280)' }}>
                  {displayTestimonials[currentIndex].role}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          {displayTestimonials.length > 1 && (
            <>
              <button
                onClick={prevTestimonial}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-all"
                style={{ color: 'var(--primary, #3b82f6)' }}
              >
                ←
              </button>
              <button
                onClick={nextTestimonial}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-all"
                style={{ color: 'var(--primary, #3b82f6)' }}
              >
                →
              </button>
            </>
          )}

          {/* Dots */}
          {displayTestimonials.length > 1 && (
            <div className="flex justify-center mt-8 space-x-2">
              {displayTestimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentIndex ? 'opacity-100' : 'opacity-40'
                  }`}
                  style={{ background: 'var(--primary, #3b82f6)' }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
