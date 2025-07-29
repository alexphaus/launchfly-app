// app/sites/[subdomain]/page.js - Dynamic website renderer
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import * as LaunchflyUI from '@/components/launchfly-ui';
import ThemedLayout from '@/components/ThemedLayout';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function DynamicWebsite({ params }) {
  const { subdomain } = params;
  
  console.log(`🎨 Rendering website for subdomain: ${subdomain}`);
  
  try {
    // Fetch business data from database
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('status', 'ready')
      .single();

    if (error || !business) {
      console.log(`❌ Business not found for subdomain: ${subdomain}`);
      return notFound();
    }

    // Extract website data
    const websiteData = business.business_data?.website;
    const businessData = business.business_data;
    
    if (!websiteData) {
      console.log(`❌ No website data for subdomain: ${subdomain}`);
      return notFound();
    }

    // Track page view
    await trackPageView(business.id);

    const { theme, layout } = websiteData;

    return (
      <ThemedLayout theme={theme}>
        <div className="dynamic-website">
          {layout?.map((section, index) => {
            const Component = LaunchflyUI[section.component];
            
            if (!Component) {
              console.warn(`⚠️ Component not found: ${section.component}`);
              return null;
            }

            return (
              <Component
                key={index}
                {...section.props}
                theme={theme}
                businessData={businessData}
              />
            );
          })}
        </div>
      </ThemedLayout>
    );

  } catch (error) {
    console.error('Error rendering dynamic website:', error);
    return notFound();
  }
}

async function trackPageView(businessId) {
  try {
    // Increment view counter
    await supabase
      .from('businesses')
      .update({ 
        views: supabase.raw('views + 1'),
        last_viewed_at: new Date().toISOString()
      })
      .eq('id', businessId);
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }) {
  const { subdomain } = params;
  
  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_data, name')
      .eq('subdomain', subdomain)
      .eq('status', 'ready')
      .single();

    if (!business) {
      return {
        title: 'Page Not Found',
        description: 'The requested page could not be found.'
      };
    }

    const seoData = business.business_data?.website?.seo;
    const businessName = business.business_data?.businessName || business.name;

    return {
      title: seoData?.title || `${businessName} - Professional Services`,
      description: seoData?.description || `Welcome to ${businessName}. Discover our professional services and solutions.`,
      keywords: seoData?.keywords?.join(', ') || businessName,
      openGraph: {
        title: seoData?.title || businessName,
        description: seoData?.description || `Professional services by ${businessName}`,
        type: 'website',
        url: `https://${subdomain}.launchfly.site`,
      },
      twitter: {
        card: 'summary_large_image',
        title: seoData?.title || businessName,
        description: seoData?.description || `Professional services by ${businessName}`,
      }
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Professional Services',
      description: 'Discover our professional services and solutions.'
    };
  }
}
