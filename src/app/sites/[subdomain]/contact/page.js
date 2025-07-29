// app/sites/[subdomain]/contact/page.js
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import ThemedLayout from '@/components/ThemedLayout';
import ContactForm from '@/components/ContactForm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function ContactPage({ params }) {
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
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '4rem'
          }}>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: '700',
              marginBottom: '1rem',
              color: theme?.primaryColor || '#007BFF'
            }}>
              Contact {businessData?.businessName}
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: '#666',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Ready to get started? Reach out to us and let's discuss how we can help you achieve your goals.
            </p>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '3rem'
          }}>
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                marginBottom: '2rem'
              }}>
                Get In Touch
              </h2>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Email</h3>
                <p style={{ color: '#666' }}>
                  hello@{businessData?.domain || `${subdomain}.com`}
                </p>
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Response Time</h3>
                <p style={{ color: '#666' }}>
                  We typically respond within 24 hours
                </p>
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Services</h3>
                <ul style={{ listStyle: 'none', padding: '0' }}>
                  {businessData?.products?.map((product, index) => (
                    <li key={index} style={{ marginBottom: '0.5rem', color: '#666' }}>
                      • {product.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div>
              <ContactForm 
                businessId={business.id}
                theme={theme}
                businessName={businessData?.businessName}
              />
            </div>
          </div>
          
          <div style={{
            background: theme?.bgLight || '#F9FAFB',
            padding: '3rem',
            borderRadius: '12px',
            marginTop: '4rem',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
              Why Work With Us?
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '2rem',
              marginTop: '2rem'
            }}>
              <div>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
                <h4>Fast Response</h4>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Quick replies and rapid project delivery</p>
              </div>
              <div>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
                <h4>Results Focused</h4>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>We measure success by your outcomes</p>
              </div>
              <div>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
                <h4>Satisfaction Guaranteed</h4>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Your success is our commitment</p>
              </div>
            </div>
          </div>
        </div>
      </ThemedLayout>
    );

  } catch (error) {
    console.error('Error rendering contact page:', error);
    return notFound();
  }
}
