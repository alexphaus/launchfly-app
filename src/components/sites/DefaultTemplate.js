'use client';

import { useState } from 'react';
import { Phone, Mail, MapPin, Star, ArrowRight } from 'lucide-react';

export default function DefaultTemplate({ data, customization, subdomain, businessId }) {
  const [showContactForm, setShowContactForm] = useState(false);

  // Apply custom colors or defaults
  const colors = customization?.colors || {
    primary: '#007BFF',
    secondary: '#6C757D', 
    accent: '#28A745'
  };

  return (
    <>
      <style jsx global>{`
        :root {
          --color-primary: ${colors.primary};
          --color-secondary: ${colors.secondary};
          --color-accent: ${colors.accent};
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{data.logo || '🚀'}</span>
                <span className="text-xl font-bold" style={{ color: colors.primary }}>
                  {data.businessName || 'Your Business'}
                </span>
              </div>
              <div className="hidden md:flex items-center space-x-8">
                <a href="#about" className="text-gray-700 hover:text-primary transition">About</a>
                <a href="#services" className="text-gray-700 hover:text-primary transition">Services</a>
                <a href="#contact" className="text-gray-700 hover:text-primary transition">Contact</a>
              </div>
              <button 
                onClick={() => setShowContactForm(true)}
                className="px-4 py-2 rounded-lg font-medium text-white transition-all hover:shadow-lg"
                style={{ backgroundColor: colors.primary }}
              >
                Get Started
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
              <div className="text-center max-w-4xl mx-auto">
                <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                  {data.tagline || 'Transform Your Business Today'}
                </h1>
                <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                  Welcome to {data.businessName}. We help you achieve your goals with proven strategies and personalized solutions.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={() => setShowContactForm(true)}
                    className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-lg transform hover:-translate-y-1 transition-all"
                  >
                    Start Your Journey
                  </button>
                  <button className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-blue-600 transition-all">
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services/Products Section */}
        {data.products && data.products.length > 0 && (
          <section id="services" className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4" style={{ color: colors.primary }}>
                  Our Services
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                  Discover how we can help you achieve your goals
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                {data.products.slice(0, 3).map((product, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
                    <h3 className="text-2xl font-bold mb-4" style={{ color: colors.primary }}>
                      {product.name}
                    </h3>
                    <p className="text-3xl font-bold mb-4" style={{ color: colors.accent }}>
                      {product.price}
                    </p>
                    <p className="text-gray-600 mb-6">
                      {product.description}
                    </p>
                    <button 
                      onClick={() => setShowContactForm(true)}
                      className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-all"
                      style={{ backgroundColor: colors.primary }}
                    >
                      Get Started
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* About Section */}
        <section id="about" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto">
              <h2 className="text-4xl font-bold mb-8" style={{ color: colors.primary }}>
                Why Choose {data.businessName}?
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: colors.primary + '20' }}>
                    <Star className="w-8 h-8" style={{ color: colors.primary }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Expert Service</h3>
                  <p className="text-gray-600">Professional expertise you can trust</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: colors.accent + '20' }}>
                    <ArrowRight className="w-8 h-8" style={{ color: colors.accent }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Fast Results</h3>
                  <p className="text-gray-600">See improvements quickly</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: colors.secondary + '20' }}>
                    <Phone className="w-8 h-8" style={{ color: colors.secondary }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">24/7 Support</h3>
                  <p className="text-gray-600">We're here when you need us</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 text-white" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)` }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Join our satisfied customers and start your journey today.
            </p>
            <button 
              onClick={() => setShowContactForm(true)}
              className="bg-white px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-lg transform hover:-translate-y-1 transition-all"
              style={{ color: colors.primary }}
            >
              Contact Us Now
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <span className="text-2xl">{data.logo || '🚀'}</span>
                <span className="text-xl font-bold">{data.businessName}</span>
              </div>
              <p className="text-gray-400 mb-4">
                Transforming businesses with innovative solutions.
              </p>
              <div className="flex justify-center space-x-6 text-sm text-gray-400">
                <a href="#about" className="hover:text-white transition">About</a>
                <a href="#services" className="hover:text-white transition">Services</a>
                <a href="#contact" className="hover:text-white transition">Contact</a>
              </div>
            </div>
          </div>
        </footer>

        {/* Contact Form Modal */}
        {showContactForm && (
          <ContactFormModal 
            businessId={businessId}
            businessName={data.businessName}
            onClose={() => setShowContactForm(false)}
          />
        )}
      </div>
    </>
  );
}

// Contact Form Modal Component
function ContactFormModal({ businessId, businessName, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          businessId,
          source: 'website_contact_form'
        })
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
            <p className="text-gray-600">We'll be in touch within 24 hours.</p>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold mb-6">Contact {businessName}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
