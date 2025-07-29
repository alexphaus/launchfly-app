// components/launchfly-ui/CallToAction.js
export default function CallToAction({ title, subtitle, buttonText, buttonLink, theme, variant = 'primary' }) {
  const sectionStyle = {
    padding: '5rem 1rem',
    background: variant === 'primary' 
      ? theme?.gradients?.primary || 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)'
      : theme?.colors?.bgLight || '#F9FAFB',
    textAlign: 'center',
    color: variant === 'primary' ? '#ffffff' : theme?.colors?.textDark || '#1A2B48'
  };

  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto'
  };

  const titleStyle = {
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: '700',
    marginBottom: '1.5rem',
    lineHeight: '1.2'
  };

  const subtitleStyle = {
    fontSize: '1.3rem',
    marginBottom: '2.5rem',
    opacity: variant === 'primary' ? '0.9' : '1',
    lineHeight: '1.5'
  };

  const buttonStyle = {
    background: variant === 'primary' 
      ? theme?.colors?.white || '#ffffff'
      : theme?.colors?.primary || '#007BFF',
    color: variant === 'primary' 
      ? theme?.colors?.primary || '#007BFF'
      : '#ffffff',
    padding: '1.2rem 2.5rem',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderRadius: theme?.borderRadius || '8px',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'all 0.3s ease',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
  };

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <h2 style={titleStyle}>{title}</h2>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        
        {buttonText && (
          <a 
            href={buttonLink || '#contact'}
            style={buttonStyle}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-3px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
            }}
          >
            {buttonText}
          </a>
        )}
      </div>
    </section>
  );
}
