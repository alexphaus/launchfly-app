// components/launchfly-ui/NavBar.js
import { useState } from 'react';

export default function NavBar({ logo, logoText, links, ctaText, ctaLink, theme }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navStyle = {
    background: theme?.colors?.white || '#ffffff',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    position: 'sticky',
    top: '0',
    zIndex: '1000',
    padding: '1rem 0'
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const logoStyle = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '1.5rem',
    fontWeight: '700',
    color: theme?.colors?.primary || '#007BFF',
    textDecoration: 'none'
  };

  const logoIconStyle = {
    marginRight: '0.5rem',
    fontSize: '1.8rem'
  };

  const linksContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem'
  };

  const linkStyle = {
    color: theme?.colors?.textDark || '#1A2B48',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'color 0.3s'
  };

  const ctaStyle = {
    background: theme?.colors?.primary || '#007BFF',
    color: '#ffffff',
    padding: '0.75rem 1.5rem',
    borderRadius: theme?.borderRadius || '8px',
    textDecoration: 'none',
    fontWeight: '600',
    transition: 'background 0.3s'
  };

  const mobileMenuStyle = {
    display: 'none',
    flexDirection: 'column',
    position: 'absolute',
    top: '100%',
    left: '0',
    right: '0',
    background: theme?.colors?.white || '#ffffff',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
    padding: '1rem'
  };

  const hamburgerStyle = {
    display: 'none',
    flexDirection: 'column',
    cursor: 'pointer',
    padding: '0.5rem'
  };

  const hamburgerLineStyle = {
    width: '25px',
    height: '3px',
    background: theme?.colors?.textDark || '#1A2B48',
    margin: '3px 0',
    transition: '0.3s'
  };

  // Mobile styles
  const mobileStyles = `
    @media (max-width: 768px) {
      .nav-links {
        display: none !important;
      }
      .hamburger {
        display: flex !important;
      }
      .mobile-menu {
        display: ${isMenuOpen ? 'flex' : 'none'} !important;
      }
    }
  `;

  return (
    <>
      <style>{mobileStyles}</style>
      <nav style={navStyle}>
        <div style={containerStyle}>
          <a href="/" style={logoStyle}>
            {logo && <span style={logoIconStyle}>{logo}</span>}
            {logoText}
          </a>

          <div className="nav-links" style={linksContainerStyle}>
            {links?.map((link, index) => (
              <a
                key={index}
                href={link.href}
                style={linkStyle}
                onMouseOver={(e) => {
                  e.target.style.color = theme?.colors?.primary || '#007BFF';
                }}
                onMouseOut={(e) => {
                  e.target.style.color = theme?.colors?.textDark || '#1A2B48';
                }}
              >
                {link.text}
              </a>
            ))}
            
            {ctaText && (
              <a
                href={ctaLink || '#contact'}
                style={ctaStyle}
                onMouseOver={(e) => {
                  e.target.style.background = theme?.colors?.primaryDark || '#0056b3';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = theme?.colors?.primary || '#007BFF';
                }}
              >
                {ctaText}
              </a>
            )}
          </div>

          <div 
            className="hamburger"
            style={hamburgerStyle}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div style={hamburgerLineStyle}></div>
            <div style={hamburgerLineStyle}></div>
            <div style={hamburgerLineStyle}></div>
          </div>
        </div>

        <div className="mobile-menu" style={mobileMenuStyle}>
          {links?.map((link, index) => (
            <a
              key={index}
              href={link.href}
              style={{
                ...linkStyle,
                padding: '1rem 0',
                borderBottom: '1px solid #eee'
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              {link.text}
            </a>
          ))}
          
          {ctaText && (
            <a
              href={ctaLink || '#contact'}
              style={{
                ...ctaStyle,
                marginTop: '1rem',
                textAlign: 'center'
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              {ctaText}
            </a>
          )}
        </div>
      </nav>
    </>
  );
}
