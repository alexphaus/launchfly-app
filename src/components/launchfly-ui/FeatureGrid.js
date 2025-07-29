// components/launchfly-ui/FeatureGrid.js
export default function FeatureGrid({ title, subtitle, features, theme }) {
  const sectionStyle = {
    padding: '5rem 1rem',
    backgroundColor: theme?.colors?.bgLight || '#F9FAFB',
    textAlign: 'center'
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const titleStyle = {
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: '700',
    marginBottom: '1rem',
    color: theme?.colors?.textDark || '#1A2B48',
    fontFamily: theme?.fontPrimary || 'Inter, sans-serif'
  };

  const subtitleStyle = {
    fontSize: '1.2rem',
    color: theme?.colors?.textGray || '#5A6982',
    marginBottom: '3rem',
    maxWidth: '600px',
    margin: '0 auto 3rem auto'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
    marginTop: '3rem'
  };

  const featureStyle = {
    background: theme?.colors?.white || '#ffffff',
    padding: '2.5rem',
    borderRadius: theme?.borderRadius || '12px',
    boxShadow: theme?.shadows?.md || '0 4px 8px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.3s, box-shadow 0.3s'
  };

  const iconStyle = {
    fontSize: '3rem',
    marginBottom: '1.5rem',
    display: 'block'
  };

  const featureTitleStyle = {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: theme?.colors?.textDark || '#1A2B48'
  };

  const descriptionStyle = {
    color: theme?.colors?.textGray || '#5A6982',
    lineHeight: '1.6'
  };

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <h2 style={titleStyle}>{title}</h2>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        
        <div style={gridStyle}>
          {features?.map((feature, index) => (
            <div 
              key={index} 
              style={featureStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = theme?.shadows?.lg || '0 12px 20px rgba(0, 0, 0, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme?.shadows?.md || '0 4px 8px rgba(0, 0, 0, 0.1)';
              }}
            >
              <span style={iconStyle}>{feature.icon}</span>
              <h3 style={featureTitleStyle}>{feature.title}</h3>
              <p style={descriptionStyle}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
