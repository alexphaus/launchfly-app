import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import * as LaunchflyUI from '@/components/launchfly-ui';

// Mock business data for fallback
const mockBusinessData = {
  axceleratebusiness: {
    name: 'Axcelerate Business',
    theme: {
      colors: {
        primary: '#3b82f6',
        secondary: '#1e40af',
        textDark: '#1f2937',
        textGray: '#6b7280',
        borderColor: '#e5e7eb'
      },
      font: 'Inter',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    layout: [
      {
        component: 'NavBar',
        props: {
          businessName: 'Axcelerate Business',
          links: ['Home', 'About', 'Services', 'Contact']
        }
      },
      {
        component: 'Hero',
        props: {
          title: 'Accelerate Your Business Growth',
          subtitle: 'AI-powered solutions to streamline operations and boost productivity',
          buttonText: 'Get Started',
          buttonLink: '#contact'
        }
      },
      {
        component: 'FeatureGrid',
        props: {
          title: 'Why Choose Us',
          features: [
            {
              title: 'AI Integration',
              description: 'Leverage cutting-edge AI to automate processes',
              icon: '🤖'
            },
            {
              title: 'Scalable Solutions',
              description: 'Grow with confidence using our flexible platform',
              icon: '📈'
            },
            {
              title: 'Expert Support',
              description: '24/7 dedicated support from our expert team',
              icon: '🎯'
            }
          ]
        }
      },
      {
        component: 'Footer',
        props: {
          companyName: 'Axcelerate Business',
          links: [
            { href: '#privacy', label: 'Privacy Policy' },
            { href: '#terms', label: 'Terms of Service' }
          ]
        }
      }
    ]
  },
  innovativesolutionshub: {
    name: 'Innovative Solutions Hub',
    theme: {
      colors: {
        primary: '#10b981',
        secondary: '#059669',
        textDark: '#1f2937',
        textGray: '#6b7280',
        borderColor: '#e5e7eb'
      },
      font: 'Inter',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    layout: [
      {
        component: 'NavBar',
        props: {
          businessName: 'Innovative Solutions Hub',
          links: ['Home', 'About', 'Solutions', 'Contact']
        }
      },
      {
        component: 'Hero',
        props: {
          title: 'Transform Your Business with Innovation',
          subtitle: 'Cutting-edge solutions that drive growth and efficiency for modern businesses',
          buttonText: 'Get Started',
          buttonLink: '#contact'
        }
      },
      {
        component: 'FeatureGrid',
        props: {
          title: 'Our Solutions',
          features: [
            {
              title: 'Digital Transformation',
              description: 'Modernize your operations with our comprehensive digital solutions',
              icon: '🚀'
            },
            {
              title: 'Innovation Strategy',
              description: 'Strategic guidance to stay ahead in competitive markets',
              icon: '💡'
            },
            {
              title: 'Technology Integration',
              description: 'Seamlessly integrate new technologies into your workflow',
              icon: '⚙️'
            }
          ]
        }
      },
      {
        component: 'Footer',
        props: {
          companyName: 'Innovative Solutions Hub',
          links: [
            { href: '#privacy', label: 'Privacy Policy' },
            { href: '#terms', label: 'Terms of Service' }
          ]
        }
      }
    ]
  }
};

// Enhanced wrapper to inject dynamic theme variables and styling
function ThemedLayout({ theme, children }) {
  if (!theme) return <main>{children}</main>;
  
  const style = {
    '--primary': theme.colors?.primary || '#3b82f6',
    '--secondary': theme.colors?.secondary || '#1e40af',
    '--accent': theme.colors?.accent || '#10b981',
    '--text-dark': theme.colors?.textDark || '#1a1a1a',
    '--text-gray': theme.colors?.textGray || '#666666',
    '--background': theme.colors?.background || '#ffffff',
    '--border-color': theme.colors?.borderColor || '#e5e5e5',
    '--gradient-bg': theme.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    '--font-family': theme.font ? `'${theme.font}', sans-serif` : 'system-ui, sans-serif',
  };
  
  // Add dynamic CSS classes based on theme style and mood
  const themeClasses = [
    'dynamic-website',
    theme.style ? `style-${theme.style}` : 'style-modern',
    theme.mood ? `mood-${theme.mood}` : 'mood-professional'
  ].join(' ');
  
  return (
    <main style={style} className={themeClasses}>
      {/* Inject custom CSS for this specific theme */}
      <style jsx>{`
        .dynamic-website {
          font-family: var(--font-family);
          color: var(--text-dark);
          background: var(--background);
        }
        
        /* Style variations */
        .style-elegant h1, .style-elegant h2, .style-elegant h3 {
          font-family: 'Playfair Display', serif;
        }
        
        .style-bold {
          font-weight: 600;
        }
        
        .style-creative {
          overflow-x: hidden;
        }
        
        .style-minimalist section {
          padding: 3rem 1rem;
        }
        
        .style-luxury {
          background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
        }
        
        /* Mood variations */
        .mood-energetic {
          animation: subtle-pulse 3s ease-in-out infinite;
        }
        
        .mood-calm section {
          transition: all 0.3s ease;
        }
        
        .mood-playful {
          cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="%23ff6b6b"/></svg>'), auto;
        }
        
        @keyframes subtle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.002); }
        }
      `}</style>
      {children}
    </main>
  );
}

export default async function DynamicWebsite({ params }) {
  let businessData = null;
  
  try {
    // Try to get data from Supabase first
    const supabase = createServerComponentClient({ cookies });
    
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', params.subdomain)
      .eq('status', 'ready')
      .single();

    if (business && !error) {
      businessData = business.business_data;
      console.log('✅ Loaded from database:', params.subdomain);
    } else {
      console.log('📦 Using mock data for:', params.subdomain);
    }
  } catch (err) {
    console.log('⚠️  Database error, using mock data:', err.message);
  }
  
  // Fall back to mock data if no database data
  if (!businessData) {
    businessData = mockBusinessData[params.subdomain];
  }
  
  if (!businessData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔍 Business Not Found</h1>
          <p className="text-gray-600 mb-4">No website found for subdomain: <code className="bg-gray-100 px-2 py-1 rounded">{params.subdomain}</code></p>
          <div className="text-sm text-gray-500 space-y-1">
            <p><strong>Available mock sites:</strong></p>
            <p>• axceleratebusiness</p>
            <p><strong>To create new sites:</strong></p>
            <p>Go to /dashboard/test123 and generate a business</p>
          </div>
        </div>
      </div>
    );
  }

  const theme = businessData.theme || {};
  const layout = businessData.layout || [];

  return (
    <ThemedLayout theme={theme}>
      <div className="dynamic-website">
        {layout.map((section, index) => {
          const Component = LaunchflyUI[section.component];
          if (!Component) {
            console.warn(`Component ${section.component} not found`);
            return null;
          }
          
          return (
            <Component
              key={index}
              {...section.props}
            />
          );
        })}
      </div>
    </ThemedLayout>
  );
}
