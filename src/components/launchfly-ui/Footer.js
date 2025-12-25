// src/components/launchfly-ui/Footer.js
'use client';

export default function Footer({ 
  businessName = "Your Business",
  logo = "🚀",
  description = "Professional solutions for your success",
  email = "hello@yourbusiness.com",
  phone = "(555) 123-4567",
  address = "123 Business St, City, State 12345",
  socials = {},
  links = [],
  showBranding = true
}) {
  const currentYear = new Date().getFullYear();
  
  const defaultLinks = [
    { title: "About", href: "#about" },
    { title: "Services", href: "#services" },
    { title: "Contact", href: "#contact" },
    { title: "Privacy", href: "#privacy" }
  ];
  
  const displayLinks = links.length > 0 ? links : defaultLinks;

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-2xl">{logo}</span>
              <span className="font-bold text-xl" style={{ color: 'var(--primary, #3b82f6)' }}>
                {businessName}
              </span>
            </div>
            <p className="text-gray-400 mb-6 max-w-md">
              {description}
            </p>
            
            {/* Contact Info */}
            <div className="space-y-2 text-sm text-gray-400">
              {email && (
                <div className="flex items-center">
                  <span className="mr-2">📧</span>
                  <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                    {email}
                  </a>
                </div>
              )}
              {phone && (
                <div className="flex items-center">
                  <span className="mr-2">📞</span>
                  <a href={`tel:${phone}`} className="hover:text-white transition-colors">
                    {phone}
                  </a>
                </div>
              )}
              {address && (
                <div className="flex items-start">
                  <span className="mr-2 mt-1">📍</span>
                  <span>{address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {displayLinks.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social & Newsletter */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Connect</h3>
            
            {/* Social Links */}
            {Object.keys(socials).length > 0 && (
              <div className="flex space-x-4 mb-6">
                {socials.facebook && (
                  <a href={socials.facebook} className="text-gray-400 hover:text-white transition-colors">
                    📘
                  </a>
                )}
                {socials.twitter && (
                  <a href={socials.twitter} className="text-gray-400 hover:text-white transition-colors">
                    🐦
                  </a>
                )}
                {socials.linkedin && (
                  <a href={socials.linkedin} className="text-gray-400 hover:text-white transition-colors">
                    💼
                  </a>
                )}
                {socials.instagram && (
                  <a href={socials.instagram} className="text-gray-400 hover:text-white transition-colors">
                    📸
                  </a>
                )}
              </div>
            )}

            {/* Newsletter Signup */}
            <div>
              <p className="text-gray-400 text-sm mb-3">Stay updated with our latest news</p>
              <div className="flex">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-l-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  className="px-4 py-2 rounded-r-lg font-semibold text-white"
                  style={{ background: 'var(--primary, #3b82f6)' }}
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
          <p>&copy; {currentYear} {businessName}. All rights reserved.</p>
          {showBranding && (
            <p className="text-xs text-gray-600 mt-2">
              Powered by <a href="https://launchfly.ai" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">Launchfly</a>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
