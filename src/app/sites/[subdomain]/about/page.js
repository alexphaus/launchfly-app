// app/sites/[subdomain]/about/page.js
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import ThemedLayout from '@/components/ThemedLayout';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function AboutPage({ params }) {
  const { subdomain } = params;
  
  try {
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('status', 'ready')
      .single();

    if (error || !business) {
      return notFound();
    }

    const websiteData = business.business_data?.website;
    const businessData = business.business_data;
    
    if (!websiteData) {
      return notFound();
    }

    const { theme } = websiteData;

    return (
      <ThemedLayout theme={theme}>
        <div style={{
          padding: '5rem 1rem',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '700',
            marginBottom: '2rem',
            color: theme?.primaryColor || '#007BFF'
          }}>
            About {businessData?.businessName}
          </h1>
          
          <div style={{
            fontSize: '1.2rem',
            lineHeight: '1.8',
            color: '#333'
          }}>
            <p style={{ marginBottom: '2rem' }}>
              Welcome to {businessData?.businessName}, where {businessData?.tagline?.toLowerCase()}.
            </p>
            
            <p style={{ marginBottom: '2rem' }}>
              Our mission is to help you achieve your goals through proven strategies and 
              personalized solutions. With expertise in {business.form_data?.businessType}, 
              we understand the unique challenges you face and have the tools to overcome them.
            </p>
            
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '600',
              marginBottom: '1rem',
              marginTop: '3rem'
            }}>
              Why Choose Us?
            </h2>
            
            <ul style={{
              listStyle: 'none',
              padding: '0'
            }}>
              <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start' }}>
                <span style={{ marginRight: '0.5rem', color: theme?.primaryColor }}>✓</span>
                <strong>Proven Results:</strong> Our methods are tested and deliver real outcomes.
              </li>
              <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start' }}>
                <span style={{ marginRight: '0.5rem', color: theme?.primaryColor }}>✓</span>
                <strong>Personalized Approach:</strong> Every solution is tailored to your specific needs.
              </li>
              <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start' }}>
                <span style={{ marginRight: '0.5rem', color: theme?.primaryColor }}>✓</span>
                <strong>Ongoing Support:</strong> We're with you every step of the journey.
              </li>
            </ul>
            
            <div style={{
              background: theme?.bgLight || '#F9FAFB',
              padding: '2rem',
              borderRadius: '12px',
              marginTop: '3rem'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>Ready to Get Started?</h3>
              <p style={{ marginBottom: '1.5rem' }}>
                Take the first step toward achieving your goals. Contact us today for a 
                personalized consultation.
              </p>
              <a 
                href="#contact"
                style={{
                  background: theme?.primaryColor || '#007BFF',
                  color: '#ffffff',
                  padding: '1rem 2rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                Contact Us Now
              </a>
            </div>
          </div>
        </div>
      </ThemedLayout>
    );

  } catch (error) {
    console.error('Error rendering about page:', error);
    return notFound();
  }
}
