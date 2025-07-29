// components/ContactForm.js
'use client';
import { useState } from 'react';

export default function ContactForm({ businessId, theme, businessName }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    service: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/contact-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          formData,
          source: 'website_contact_form'
        })
      });

      if (response.ok) {
        setSubmitted(true);
        setFormData({ name: '', email: '', phone: '', message: '', service: '' });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }

    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const formStyle = {
    background: '#ffffff',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
  };

  const inputStyle = {
    width: '100%',
    padding: '1rem',
    border: '2px solid #E4E7EB',
    borderRadius: '8px',
    fontSize: '1rem',
    marginBottom: '1rem',
    transition: 'border-color 0.3s'
  };

  const buttonStyle = {
    width: '100%',
    padding: '1rem',
    background: theme?.primaryColor || '#007BFF',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.3s'
  };

  if (submitted) {
    return (
      <div style={{
        ...formStyle,
        textAlign: 'center',
        background: '#E8F5E8'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h3 style={{ marginBottom: '1rem', color: '#2D5A2D' }}>
          Thank You!
        </h3>
        <p style={{ color: '#2D5A2D', marginBottom: '1rem' }}>
          Your message has been sent successfully. We'll get back to you within 24 hours.
        </p>
        <button 
          onClick={() => setSubmitted(false)}
          style={{
            ...buttonStyle,
            background: '#2D5A2D'
          }}
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <div style={formStyle}>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '1.5rem'
      }}>
        Send us a message
      </h2>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          value={formData.name}
          onChange={handleChange}
          required
          style={inputStyle}
          onFocus={(e) => e.target.style.borderColor = theme?.primaryColor || '#007BFF'}
          onBlur={(e) => e.target.style.borderColor = '#E4E7EB'}
        />
        
        <input
          type="email"
          name="email"
          placeholder="Your Email"
          value={formData.email}
          onChange={handleChange}
          required
          style={inputStyle}
          onFocus={(e) => e.target.style.borderColor = theme?.primaryColor || '#007BFF'}
          onBlur={(e) => e.target.style.borderColor = '#E4E7EB'}
        />
        
        <input
          type="tel"
          name="phone"
          placeholder="Your Phone (Optional)"
          value={formData.phone}
          onChange={handleChange}
          style={inputStyle}
          onFocus={(e) => e.target.style.borderColor = theme?.primaryColor || '#007BFF'}
          onBlur={(e) => e.target.style.borderColor = '#E4E7EB'}
        />
        
        <select
          name="service"
          value={formData.service}
          onChange={handleChange}
          style={inputStyle}
          onFocus={(e) => e.target.style.borderColor = theme?.primaryColor || '#007BFF'}
          onBlur={(e) => e.target.style.borderColor = '#E4E7EB'}
        >
          <option value="">Select a service (Optional)</option>
          <option value="consultation">Consultation</option>
          <option value="strategy">Strategy Package</option>
          <option value="done-for-you">Done-for-You Service</option>
          <option value="other">Other</option>
        </select>
        
        <textarea
          name="message"
          placeholder="Tell us about your project or goals..."
          value={formData.message}
          onChange={handleChange}
          required
          rows={4}
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: '120px'
          }}
          onFocus={(e) => e.target.style.borderColor = theme?.primaryColor || '#007BFF'}
          onBlur={(e) => e.target.style.borderColor = '#E4E7EB'}
        />
        
        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
          onMouseOver={(e) => {
            if (!loading) {
              e.target.style.background = theme?.primaryDark || '#0056b3';
            }
          }}
          onMouseOut={(e) => {
            e.target.style.background = theme?.primaryColor || '#007BFF';
          }}
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>
      
      <p style={{
        fontSize: '0.9rem',
        color: '#666',
        textAlign: 'center',
        marginTop: '1rem'
      }}>
        We typically respond within 24 hours
      </p>
    </div>
  );
}
