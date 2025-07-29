'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as LaunchflyUI from '@/components/launchfly-ui';

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

export default function DynamicWebsite({ params }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('subdomain', params.subdomain)
          .eq('status', 'ready')
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            setError('Website not found');
          } else {
            setError('Failed to load website');
          }
          return;
        }

        setBusiness(data);
      } catch (err) {
        setError('Failed to load website');
        console.error('Error fetching business:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBusiness();
  }, [params.subdomain, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading website...</p>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Website Not Found</h1>
          <p className="text-gray-600 mb-8">
            {error || 'This website is not available or is still being generated.'}
          </p>
          <a 
            href="/" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Visit Launchfly
          </a>
        </div>
      </div>
    );
  }

  // Get business data with fallbacks
  const businessData = business.business_data || {};
  const theme = businessData.theme || {};
  const layout = businessData.layout || [];

  // If no layout is defined, create a default layout
  const defaultLayout = [
    {
      component: 'NavBar',
      props: {
        businessName: businessData.businessName || business.name || 'Your Business',
        logo: businessData.logo || '🚀',
        links: ['About', 'Services', 'Pricing', 'Contact'],
        ctaText: 'Get Started'
      }
    },
    {
      component: 'Hero',
      props: {
        title: businessData.tagline || 'Transform Your Vision Into Reality',
        subtitle: `Welcome to ${businessData.businessName || business.name || 'Your Business'}`,
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
        })) || []
      }
    },
    {
      component: 'TestimonialSlider',
      props: {
        testimonials: businessData.testimonials || []
      }
    },
    {
      component: 'PricingTable',
      props: {
        plans: businessData.products?.map(product => ({
          name: product.name,
          price: product.price,
          description: product.description,
          features: ['Everything included', 'Email support', '30-day guarantee'],
          ctaText: 'Get Started',
          popular: false
        })) || []
      }
    },
    {
      component: 'CallToAction',
      props: {
        title: 'Ready to Get Started?',
        subtitle: `Join ${businessData.businessName || business.name || 'us'} today`,
        ctaText: 'Start Now'
      }
    },
    {
      component: 'Footer',
      props: {
        businessName: businessData.businessName || business.name || 'Your Business',
        logo: businessData.logo || '🚀',
        description: businessData.tagline || 'Professional solutions for your success'
      }
    }
  ];

  const finalLayout = layout.length > 0 ? layout : defaultLayout;

  return (
    <ThemedLayout theme={theme}>
      <div className="min-h-screen">
        {finalLayout.map((section, index) => {
          const Component = LaunchflyUI[section.component];
          
          if (!Component) {
            console.warn(`Component ${section.component} not found`);
            return null;
          }

          return (
            <Component 
              key={index} 
              {...(section.props || {})} 
            />
          );
        })}
      </div>
    </ThemedLayout>
  );
}
