// components/launchfly-ui/TestimonialSlider.js
import { useState, useEffect } from 'react';

export default function TestimonialSlider({ testimonials, theme }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (testimonials?.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [testimonials?.length]);

  const sectionStyle = {
    padding: '5rem 1rem',
    backgroundColor: theme?.colors?.white || '#ffffff',
    textAlign: 'center'
  };

  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto'
  };

  const testimonialStyle = {
    background: theme?.colors?.bgLight || '#F9FAFB',
    padding: '3rem',
    borderRadius: theme?.borderRadius || '12px',
    position: 'relative',
    boxShadow: theme?.shadows?.md || '0 4px 8px rgba(0, 0, 0, 0.1)'
  };

  const quoteStyle = {
    fontSize: '1.3rem',
    fontStyle: 'italic',
    lineHeight: '1.6',
    color: theme?.colors?.textDark || '#1A2B48',
    marginBottom: '2rem'
  };

  const authorStyle = {
    fontWeight: '600',
    fontSize: '1.1rem',
    color: theme?.colors?.primary || '#007BFF',
    marginBottom: '0.5rem'
  };

  const ratingStyle = {
    color: '#FFD700',
    fontSize: '1.2rem',
    marginBottom: '1rem'
  };

  const dotsStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '2rem'
  };

  const dotStyle = {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: theme?.colors?.borderLight || '#E4E7EB',
    cursor: 'pointer',
    transition: 'background 0.3s'
  };

  const activeDotStyle = {
    ...dotStyle,
    background: theme?.colors?.primary || '#007BFF'
  };

  if (!testimonials?.length) return null;

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <h2 style={{
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: '700',
          marginBottom: '3rem',
          color: theme?.colors?.textDark || '#1A2B48'
        }}>
          What Our Customers Say
        </h2>
        
        <div style={testimonialStyle}>
          {currentTestimonial.rating && (
            <div style={ratingStyle}>
              {'★'.repeat(currentTestimonial.rating)}
            </div>
          )}
          
          <blockquote style={quoteStyle}>
            "{currentTestimonial.text}"
          </blockquote>
          
          <div style={authorStyle}>
            {currentTestimonial.name}
          </div>
          
          {currentTestimonial.company && (
            <div style={{ 
              color: theme?.colors?.textGray || '#5A6982',
              fontSize: '0.9rem'
            }}>
              {currentTestimonial.company}
            </div>
          )}
        </div>

        {testimonials.length > 1 && (
          <div style={dotsStyle}>
            {testimonials.map((_, index) => (
              <button
                key={index}
                style={index === currentIndex ? activeDotStyle : dotStyle}
                onClick={() => setCurrentIndex(index)}
                aria-label={`View testimonial ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
