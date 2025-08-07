// src/app/sites/[subdomain]/page.js
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import * as LaunchflyUI from '@/components/launchfly-ui';
import OptimizedHero from '@/components/launchfly-ui/OptimizedHero';
import SalesAgent from '@/components/SalesAgent';
import { TrackingScript, getTrackingConfig } from '@/lib/analytics-tracker';
import { 
  getVisitorId, 
  getVisitorSegment, 
  assignVariant, 
  getActiveExperiments,
  recordImpression,
  personalizeContent,
  createDefaultExperiments
} from '@/lib/conversion-optimizer';

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
          links: ['Home', 'About', 'Services', 'Products', 'Contact']
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
        component: 'TestimonialSlider',
        props: {
          title: 'What Our Clients Say',
          testimonials: [
            {
              name: 'Sarah Johnson',
              role: 'Business Owner',
              content: 'Axcelerate Business completely transformed our operations. We saw 300% growth in efficiency within just 3 months!',
              avatar: '👩‍💼',
              rating: 5
            },
            {
              name: 'Mike Chen',
              role: 'CEO',
              content: 'The AI integration was seamless and the results were immediate. Our productivity has never been higher.',
              avatar: '👨‍💻',
              rating: 5
            },
            {
              name: 'Emily Rodriguez',
              role: 'Operations Manager',
              content: 'Professional, reliable, and incredibly effective. This is exactly what we needed to scale our business.',
              avatar: '👩‍🚀',
              rating: 5
            }
          ]
        }
      },
      {
        component: 'ProductGrid',
        props: {
          title: 'Our Solutions',
          subtitle: 'Choose the perfect package for your business needs',
          products: [
            {
              id: 'ai-starter',
              name: 'AI Starter',
              price: '$299',
              period: 'one-time',
              description: 'Perfect for small businesses getting started with AI',
              icon: '🚀',
              features: [
                'AI-powered automation setup',
                'Basic workflow optimization',  
                'Email support',
                '30-day money-back guarantee'
              ],
              ctaText: 'Get Started'
            },
            {
              id: 'ai-pro',
              name: 'AI Professional',
              price: '$699',
              period: 'one-time',
              description: 'Advanced AI solutions for growing businesses',
              icon: '⭐',
              features: [
                'Everything in Starter',
                'Advanced AI integrations',
                'Custom workflow design',
                'Priority support',
                'Performance analytics'
              ],
              ctaText: 'Go Pro',
              popular: true
            },
            {
              id: 'ai-enterprise',
              name: 'AI Enterprise',
              price: '$1,499',
              period: 'one-time',
              description: 'Complete AI transformation for large organizations',
              icon: '💎',
              features: [
                'Everything in Professional',
                'Dedicated AI consultant',
                'Custom AI development',
                'SLA guarantee',
                'Unlimited revisions'
              ],
              ctaText: 'Contact Sales'
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
  let businessId = null;
  let business = null;
  
  try {
    // Try to get data from Supabase first
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    const { data: businessRecord, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('status', 'ready')
      .single();

    if (businessRecord && !error) {
      business = businessRecord;
      businessData = businessRecord.business_data;
      businessId = businessRecord.id;
      console.log('✅ Loaded from database:', subdomain);
      
      // Initialize experiments if not exists
      if (!businessData.experiments) {
        businessData.experiments = createDefaultExperiments();
        // Update business with default experiments
        await supabase
          .from('businesses')
          .update({ 
            business_data: businessData,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessId);
      }
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

  // Get visitor tracking data
  const cookieStore = await cookies();
  const visitorId = await getVisitorId(cookieStore);
  
  // Create segments based on available headers
  // Note: In production, you'd get these from the actual request headers
  const segments = {
    device: 'desktop',
    timeOfDay: new Date().getHours() < 12 ? 'morning' : 'afternoon',
    trafficSource: 'direct',
    returning: false
  };
  
  // Get active experiments and assign variants
  let heroVariant = null;
  if (businessId) {
    const experiments = await getActiveExperiments(businessId, 'Hero');
    if (experiments.length > 0) {
      const assignment = assignVariant(visitorId, experiments);
      if (assignment) {
        heroVariant = assignment;
        // Record impression
        await recordImpression({
          businessId,
          visitorId,
          experimentId: assignment.experimentId,
          variantId: assignment.variantId,
          component: 'Hero',
          segments
        });
      }
    }
  }
  
  const theme = businessData.theme || {};
  let layout = businessData.layout || [];

  // If no layout exists or layout is empty, create a fallback layout
  if (!layout || layout.length === 0) {
    console.log('Creating fallback layout for:', subdomain);
    layout = [
      {
        component: 'NavBar',
        props: {
          businessName: businessData.businessName || businessData.name || 'Your Business',
          logo: businessData.logo || '🚀',
          links: ['About', 'Services', 'Pricing', 'Contact'],
          ctaText: 'Get Started'
        }
      },
      {
        component: 'Hero',
        props: {
          title: businessData.tagline || 'Transform Your Vision Into Reality',
          subtitle: `Welcome to ${businessData.businessName || businessData.name || 'Your Business'}`,
          ctaText: 'Get Started Today'
        }
      },
      {
        component: 'FeatureGrid',
        props: {
          title: 'Why Choose Us',
          features: businessData.products?.slice(0, 3).map(product => ({
            icon: '⭐',
            title: product.name,
            description: product.description
          })) || [
            { icon: '⚡', title: 'Fast Results', description: 'Quick and efficient solutions' },
            { icon: '🎯', title: 'Targeted Approach', description: 'Customized for your needs' },
            { icon: '🚀', title: 'Growth Focused', description: 'Built for success' }
          ]
        }
      },
      {
        component: 'TestimonialSlider',
        props: {
          title: 'What Our Clients Say',
          testimonials: businessData.testimonials || []
        }
      },
      {
        component: 'PricingTable',
        props: {
          title: 'Choose Your Plan',
          plans: businessData.products?.map(product => ({
            name: product.name,
            price: product.price,
            description: product.description,
            features: ['Feature 1', 'Feature 2', 'Feature 3'],
            ctaText: 'Get Started',
            popular: false
          })) || []
        }
      },
      {
        component: 'CallToAction',
        props: {
          title: 'Ready to Get Started?',
          subtitle: 'Join us today and transform your business',
          ctaText: 'Start Now'
        }
      },
      {
        component: 'Footer',
        props: {
          businessName: businessData.businessName || businessData.name || 'Your Business',
          logo: businessData.logo || '🚀',
          description: businessData.tagline || 'Professional solutions for your success'
        }
      }
    ];
  }

  // Generate tracking configuration
  const trackingConfig = getTrackingConfig(
    visitorId, 
    businessId,
    heroVariant ? {
      experimentId: heroVariant.experimentId,
      variantId: heroVariant.variantId
    } : null
  );

  return (
    <ThemedLayout theme={theme}>
      <div className="dynamic-website">
        {/* Inject tracking script */}
        <TrackingScript config={trackingConfig} />
        
        {layout.map((section, index) => {
          // Use OptimizedHero for Hero components
          if (section.component === 'Hero' && heroVariant) {
            const personalizedProps = personalizeContent(
              { ...section.props, ...heroVariant.variant.props },
              segments,
              businessData
            );
            
            return (
              <OptimizedHero
                key={index}
                {...personalizedProps}
                variant={heroVariant.variant}
                segments={segments}
              />
            );
          }
          
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

        {/* Enhanced AI Sales Agent - High-Converting Version */}
        <SalesAgent 
          product={{
            name: businessData.businessName || businessData.name || 'Premium Solution',
            price: businessData.products?.[0]?.price || '$97',
            fakePrice: '$497', // Always anchor high for psychology
            savings: '$400',
            benefit: businessData.tagline || 'achieve your goals faster',
            guarantee: '30-day money back',
            scarcity: 'Only 3 left at this price',
            urgency: '10 minute hold',
            bonuses: [
              'Bonus Training ($197 value)',
              'Priority Support ($97/mo value)', 
              'Success Templates ($297 value)'
            ]
          }}
          businessId={businessId}
          subdomain={subdomain}
          config={{
            triggerDelay: 15,
            aggressiveness: 8, // More aggressive for higher conversions
            maxDiscount: 40,
            urgencyTimer: 600 // 10 minutes
          }}
        />
      </div>
    </ThemedLayout>
  );
}
