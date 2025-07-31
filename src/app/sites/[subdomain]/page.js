// app/sites/[subdomain]/page.js - Updated version
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import * as LaunchflyUI from '@/components/launchfly-ui';

// Import the new ProductShowcase component
import ProductShowcase from '@/components/launchfly-ui/ProductShowcase';

// Register the new component
const componentMap = {
  ...LaunchflyUI,
  ProductShowcase
};

// Mock business data remains the same...
const mockBusinessData = {
  axceleratebusiness: {
    id: 'mock-axcelerate-id',
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
          links: ['Home', 'About', 'Products', 'Contact']
        }
      },
      {
        component: 'Hero',
        props: {
          title: 'Accelerate Your Business Growth',
          subtitle: 'AI-powered solutions to streamline operations and boost productivity',
          buttonText: 'View Products',
          buttonLink: '#products'
        }
      },
      {
        component: 'ProductShowcase',
        props: {
          title: 'Our Solutions',
          subtitle: 'Choose the perfect package for your needs',
          products: [
            {
              id: 'starter',
              name: 'AI Starter',
              price: '$99',
              description: 'Perfect for small businesses getting started with AI',
              features: [
                'Basic AI automation',
                'Email support',
                'Monthly reports',
                '30-day guarantee'
              ]
            },
            {
              id: 'growth',
              name: 'AI Growth',
              price: '$299',
              description: 'Scale your business with advanced AI features',
              features: [
                'All Starter features',
                'Advanced automation',
                'Priority support',
                'Custom workflows',
                'Weekly optimization'
              ],
              popular: true
            },
            {
              id: 'enterprise',
              name: 'AI Enterprise',
              price: '$599',
              description: 'Full AI transformation for large organizations',
              features: [
                'All Growth features',
                'Dedicated AI specialist',
                'Custom integrations',
                'White-label options',
                '24/7 phone support'
              ]
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
    id: 'mock-innovative-id',
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
          links: ['Home', 'Solutions', 'Products', 'Contact']
        }
      },
      {
        component: 'Hero',
        props: {
          title: 'Transform Your Business with Innovation',
          subtitle: 'Cutting-edge solutions that drive growth and efficiency',
          buttonText: 'Explore Solutions',
          buttonLink: '#products'
        }
      },
      {
        component: 'ProductShowcase',
        props: {
          title: 'Innovation Packages',
          subtitle: 'Select your transformation journey',
          products: [
            {
              id: 'basic',
              name: 'Innovation Basic',
              price: '$149',
              description: 'Start your digital transformation journey',
              features: [
                'Digital assessment',
                'Basic optimization',
                'Monthly check-ins',
                'Email support'
              ]
            },
            {
              id: 'pro',
              name: 'Innovation Pro',
              price: '$399',
              description: 'Accelerate growth with proven strategies',
              features: [
                'Everything in Basic',
                'Advanced analytics',
                'Weekly strategy calls',
                'Custom roadmap',
                'Priority implementation'
              ],
              popular: true
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
  let businessRecord = null;
  
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
      businessRecord = business;
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
    const mockData = mockBusinessData[subdomain];
    if (mockData) {
      businessData = mockData;
      // For mock data, create a fake business record
      businessRecord = {
        id: mockData.id || `mock-${subdomain}`,
        subdomain: subdomain,
        name: mockData.name,
        business_data: mockData
      };
    }
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
            <p>• innovativesolutionshub</p>
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
          const Component = componentMap[section.component];
          if (!Component) {
            console.warn(`Component ${section.component} not found`);
            return null;
          }
          
          // Inject business data for components that need it
          const enhancedProps = { ...section.props };
          
          // If it's ProductShowcase, add the business data
          if (section.component === 'ProductShowcase') {
            enhancedProps.businessId = businessRecord.id;
            enhancedProps.businessSubdomain = subdomain;
          }
          
          return (
            <Component
              key={index}
              {...enhancedProps}
            />
          );
        })}
      </div>
    </ThemedLayout>
  );
}