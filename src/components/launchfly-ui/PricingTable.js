// components/launchfly-ui/PricingTable.js
export default function PricingTable({ plans, theme }) {
  const sectionStyle = {
    padding: '5rem 1rem',
    backgroundColor: theme?.colors?.bgLight || '#F9FAFB',
    textAlign: 'center'
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
    marginTop: '3rem'
  };

  const planStyle = {
    background: theme?.colors?.white || '#ffffff',
    padding: '2.5rem',
    borderRadius: theme?.borderRadius || '12px',
    boxShadow: theme?.shadows?.md || '0 4px 8px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    transition: 'transform 0.3s, box-shadow 0.3s'
  };

  const featuredPlanStyle = {
    ...planStyle,
    border: `3px solid ${theme?.colors?.primary || '#007BFF'}`,
    transform: 'scale(1.05)'
  };

  const planNameStyle = {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: theme?.colors?.textDark || '#1A2B48'
  };

  const priceStyle = {
    fontSize: '3rem',
    fontWeight: '800',
    color: theme?.colors?.primary || '#007BFF',
    marginBottom: '0.5rem'
  };

  const periodStyle = {
    color: theme?.colors?.textGray || '#5A6982',
    marginBottom: '2rem'
  };

  const featureListStyle = {
    listStyle: 'none',
    padding: '0',
    marginBottom: '2rem',
    textAlign: 'left'
  };

  const featureItemStyle = {
    padding: '0.5rem 0',
    color: theme?.colors?.textDark || '#1A2B48',
    display: 'flex',
    alignItems: 'center'
  };

  const checkIconStyle = {
    color: theme?.colors?.success || '#28a745',
    marginRight: '0.75rem',
    fontWeight: 'bold'
  };

  const ctaButtonStyle = {
    width: '100%',
    padding: '1rem',
    background: theme?.colors?.primary || '#007BFF',
    color: '#ffffff',
    border: 'none',
    borderRadius: theme?.borderRadius || '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.3s'
  };

  const featuredButtonStyle = {
    ...ctaButtonStyle,
    background: theme?.gradients?.primary || 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)'
  };

  const popularBadgeStyle = {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: theme?.colors?.primary || '#007BFF',
    color: '#ffffff',
    padding: '0.5rem 1.5rem',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600'
  };

  if (!plans?.length) return null;

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <h2 style={{
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: '700',
          marginBottom: '1rem',
          color: theme?.colors?.textDark || '#1A2B48'
        }}>
          Choose Your Plan
        </h2>
        
        <p style={{
          fontSize: '1.2rem',
          color: theme?.colors?.textGray || '#5A6982',
          marginBottom: '3rem',
          maxWidth: '600px',
          margin: '0 auto 3rem auto'
        }}>
          Start for free and scale as you grow
        </p>

        <div style={gridStyle}>
          {plans.map((plan, index) => (
            <div 
              key={index}
              style={plan.featured ? featuredPlanStyle : planStyle}
              onMouseOver={(e) => {
                if (!plan.featured) {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = theme?.shadows?.lg || '0 12px 20px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseOut={(e) => {
                if (!plan.featured) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = theme?.shadows?.md || '0 4px 8px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              {plan.featured && (
                <div style={popularBadgeStyle}>Most Popular</div>
              )}
              
              <h3 style={planNameStyle}>{plan.name}</h3>
              
              <div style={priceStyle}>
                {plan.price === 0 ? 'Free' : `$${plan.price}`}
              </div>
              
              <div style={periodStyle}>
                {plan.period || (plan.price > 0 ? 'per month' : 'forever')}
              </div>

              {plan.description && (
                <p style={{
                  color: theme?.colors?.textGray || '#5A6982',
                  marginBottom: '2rem',
                  lineHeight: '1.5'
                }}>
                  {plan.description}
                </p>
              )}

              <ul style={featureListStyle}>
                {plan.features?.map((feature, featureIndex) => (
                  <li key={featureIndex} style={featureItemStyle}>
                    <span style={checkIconStyle}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button 
                style={plan.featured ? featuredButtonStyle : ctaButtonStyle}
                onClick={() => window.location.href = plan.ctaLink || '#contact'}
                onMouseOver={(e) => {
                  e.target.style.opacity = '0.9';
                }}
                onMouseOut={(e) => {
                  e.target.style.opacity = '1';
                }}
              >
                {plan.ctaText || 'Get Started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
