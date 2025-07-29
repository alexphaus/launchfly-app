import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import DefaultTemplate from '@/components/sites/DefaultTemplate';

// Generate metadata for SEO
export async function generateMetadata({ params }) {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: business } = await supabase
    .from('businesses')
    .select('business_data')
    .eq('subdomain', params.subdomain)
    .eq('status', 'ready')
    .single();

  if (!business) {
    return {
      title: 'Site Not Found',
      description: 'This business website could not be found.'
    };
  }

  const { business_data } = business;
  
  return {
    title: `${business_data.businessName} - ${business_data.tagline}`,
    description: business_data.tagline,
    openGraph: {
      title: business_data.businessName,
      description: business_data.tagline,
      type: 'website',
      url: `https://${params.subdomain}.launchfly.ai`,
    },
    twitter: {
      card: 'summary_large_image',
      title: business_data.businessName,
      description: business_data.tagline,
    }
  };
}

// Main page component
export default async function UserSitePage({ params }) {
  const supabase = createServerComponentClient({ cookies });
  
  // Fetch business data
  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('subdomain', params.subdomain)
    .eq('status', 'ready')
    .single();

  // Show 404 if business not found
  if (error || !business) {
    notFound();
  }

  // Extract business data
  const businessData = business.business_data;
  const customization = business.customization || {};

  // Track page view (optional)
  await supabase
    .from('analytics')
    .insert({
      business_id: business.id,
      event_type: 'page_view',
      event_data: { 
        path: '/',
        user_agent: 'server-side-render'
      }
    })
    .then(() => {
      // Increment view count
      return supabase.rpc('increment_views', { business_id: business.id });
    })
    .catch(() => {
      // Ignore analytics errors
    });

  return (
    <DefaultTemplate 
      data={businessData}
      customization={customization}
      subdomain={params.subdomain}
      businessId={business.id}
    />
  );
}
