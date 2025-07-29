// components/launchfly-ui/Hero.js
export default function Hero({ title, subtitle, ctaText, ctaLink, backgroundImage, theme }) {
  const heroStyle = {
    background: backgroundImage ? `url(${backgroundImage})` : theme?.gradients?.primary || 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: theme?.colors?.white || '#ffffff',
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '4rem 1rem'
  };

  const titleStyle = {
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: '800',
    marginBottom: '1.5rem',
    lineHeight: '1.2',
    fontFamily: theme?.fontPrimary || 'Inter, sans-serif'
  };

  const subtitleStyle = {
    fontSize: 'clamp(1.2rem, 2vw, 1.5rem)',
    marginBottom: '2.5rem',
    opacity: '0.9',
    maxWidth: '600px',
    margin: '0 auto 2.5rem auto',
    lineHeight: '1.5'
  };

  const ctaStyle = {
    background: theme?.colors?.secondaryCta || '#28a745',
    color: '#ffffff',
    padding: '1rem 2rem',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderRadius: theme?.borderRadius || '8px',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'transform 0.2s, box-shadow 0.2s',
    border: 'none',
    cursor: 'pointer'
  };

  return (
    <section style={heroStyle}>
      <div style={{ maxWidth: '1200px', width: '100%' }}>
        <h1 style={titleStyle}>{title}</h1>
        <p style={subtitleStyle}>{subtitle}</p>
        {ctaText && (
          <a 
            href={ctaLink || '#contact'} 
            style={ctaStyle}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.2)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  );
}
