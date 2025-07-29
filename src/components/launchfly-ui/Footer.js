// components/launchfly-ui/Footer.js
export default function Footer({ logo, logoText, description, links, socialLinks, theme }) {
  const footerStyle = {
    background: theme?.colors?.textDark || '#1A2B48',
    color: theme?.colors?.white || '#ffffff',
    padding: '3rem 1rem 1rem 1rem'
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const topSectionStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '3rem',
    marginBottom: '2rem'
  };

  const brandSectionStyle = {
    gridColumn: '1 / -1'
  };

  const logoStyle = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '1rem',
    color: theme?.colors?.white || '#ffffff'
  };

  const logoIconStyle = {
    marginRight: '0.5rem',
    fontSize: '1.8rem'
  };

  const descriptionStyle = {
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: '1.6',
    maxWidth: '400px'
  };

  const columnStyle = {
    // Grid will handle layout
  };

  const columnTitleStyle = {
    fontSize: '1.2rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: theme?.colors?.white || '#ffffff'
  };

  const linkListStyle = {
    listStyle: 'none',
    padding: '0',
    margin: '0'
  };

  const linkItemStyle = {
    marginBottom: '0.75rem'
  };

  const linkStyle = {
    color: 'rgba(255, 255, 255, 0.8)',
    textDecoration: 'none',
    transition: 'color 0.3s'
  };

  const socialLinksStyle = {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem'
  };

  const socialLinkStyle = {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '1.5rem',
    textDecoration: 'none',
    transition: 'color 0.3s'
  };

  const bottomSectionStyle = {
    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
    paddingTop: '2rem',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)'
  };

  return (
    <footer style={footerStyle}>
      <div style={containerStyle}>
        <div style={topSectionStyle}>
          <div style={brandSectionStyle}>
            <div style={logoStyle}>
              {logo && <span style={logoIconStyle}>{logo}</span>}
              {logoText}
            </div>
            {description && (
              <p style={descriptionStyle}>{description}</p>
            )}
            
            {socialLinks && (
              <div style={socialLinksStyle}>
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    style={socialLinkStyle}
                    onMouseOver={(e) => {
                      e.target.style.color = theme?.colors?.primary || '#007BFF';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.color = 'rgba(255, 255, 255, 0.8)';
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {links?.map((column, columnIndex) => (
            <div key={columnIndex} style={columnStyle}>
              <h4 style={columnTitleStyle}>{column.title}</h4>
              <ul style={linkListStyle}>
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex} style={linkItemStyle}>
                    <a
                      href={link.href}
                      style={linkStyle}
                      onMouseOver={(e) => {
                        e.target.style.color = theme?.colors?.white || '#ffffff';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.color = 'rgba(255, 255, 255, 0.8)';
                      }}
                    >
                      {link.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={bottomSectionStyle}>
          <p>&copy; {new Date().getFullYear()} {logoText}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
