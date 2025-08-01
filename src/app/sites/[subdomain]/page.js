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

// A wrapper to inject theme variables
function ThemedLayout({ theme, children }) {
  if (!theme) return <main>{children}</main>;
  
  const style = {
    '--primary': theme.colors?.primary || '#3b82f6',
    '--secondary': theme.colors?.secondary || '#1e40af',
    '--text-dark': theme.colors?.textDark || '#1f2937',
    '--text-gray': theme.colors?.textGray || '#6b7280',
    '--border-color': theme.colors?.borderColor || '#e5e7eb',
    '--gradient-bg': theme.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    '--font-family': theme.font ? `'${theme.font}', sans-serif` : 'system-ui, sans-serif',
  };
  
  return <main style={style}>{children}</main>;
}

export default async function DynamicWebsite({ params }) {
  // Await params to fix Next.js 15 requirement
  const { subdomain } = await params;
  
  let businessData = null;
  
  try {
    // Try to get data from Supabase first
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('status', 'ready')
      .single();

    if (business && !error) {
      businessData = business.business_data;
      console.log('✅ Loaded from database:', subdomain);
    } else {
      console.log('📦 Using mock data for:', subdomain);
    }
  } catch (err) {
    console.log('⚠️  Database error, using mock data:', err.message);
  }
  
  // Fall back to mock data if no database data
  if (!businessData) {
    businessData = mockBusinessData[subdomain];
  }
  
  if (!businessData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔍 Business Not Found</h1>
          <p className="text-gray-600 mb-4">No website found for subdomain: <code className="bg-gray-100 px-2 py-1 rounded">{subdomain}</code></p>
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

  // Check if we have products to display
  const hasProducts = businessData.products && businessData.products.length > 0;

  return (
    <ThemedLayout theme={theme}>
      <div className="dynamic-website">
        {/* Render the layout components first */}
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
        
        {/* Add ProductGrid if products exist but aren't already in the layout */}
        {hasProducts && !layout.some(section => section.component === 'ProductGrid') && (
          <LaunchflyUI.ProductGrid 
            title="Our Products"
            subtitle="Discover our range of solutions designed for you"
            products={businessData.products.map(product => ({
              id: product.id || product.name.toLowerCase().replace(/\s+/g, '-'),
              name: product.name,
              price: product.price,
              description: product.description,
              image: product.image || null,
              features: product.features || []
            }))}
          />
        )}
      </div>
    </ThemedLayout>
  );
}
